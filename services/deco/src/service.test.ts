import { DatabaseSync } from 'node:sqlite'

import { type DecoConfig } from './config.ts'
import { createMemoryDb, createSqliteDb, SCHEMA } from './db.ts'
import { grantRkey } from './grants.ts'
import {
  CANCEL,
  CREATE_CHECKOUT,
  createDecoService,
  GET_STATUS,
  paidUntilFor,
} from './service.ts'
import {
  type DecoDb,
  type GrantClient,
  type MollieClient,
  type MolliePayment,
} from './types.ts'

function assert(
  condition: unknown,
  message = 'assertion failed',
): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEquals(actual: unknown, expected: unknown) {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  if (left !== right) throw new Error(`expected ${right}, got ${left}`)
}

const config: DecoConfig = {
  serviceDid: 'did:web:deco.example.com',
  publicUrl: 'https://deco.example.com',
  allowedOrigin: '*',
  plcDirectoryUrl: 'https://plc.directory',
  devTrustDidHeader: true,
  mollieApiKey: 'test_xxx',
  mollieAmount: '3.00',
  mollieCurrency: 'EUR',
  mollieDescription: 'Mu supporter subscription',
  billingMonths: 1,
  checkoutRedirectUrl: 'https://example.com/settings/supporter?checkout=return',
  issuerPdsUrl: 'https://pds.example.com',
  issuerIdentifier: 'issuer.example.com',
  issuerAppPassword: 'xxxx-xxxx-xxxx-xxxx',
  issuerDid: 'did:plc:issuer',
  subscriberListUri: 'at://did:plc:issuer/app.bsky.graph.list/subscribers',
  sweepSecret: 'sweep-secret',
  graceDays: 5,
}

const did = 'did:plc:subscriber'

function fixture(db: DecoDb) {
  let currentTime = new Date('2026-01-31T12:00:00.000Z')
  let paymentCreates = 0
  let subscriptionCreates = 0
  let cancellationCalls = 0
  let grantFailures = 0
  const payments = new Map<string, MolliePayment>()
  const subscriptions = new Map<string, { id: string }>()
  const memberships = new Set<string>()
  const grantsPut: string[] = []
  const grantsRemoved: string[] = []

  const mollie: MollieClient = {
    async createCustomer() {
      return { id: 'cst_1' }
    },
    async createFirstPayment({ did: paymentDid, customerId }) {
      const id = `tr_${++paymentCreates}`
      const payment: MolliePayment = {
        id,
        status: 'open',
        sequenceType: 'first',
        customerId,
        createdAt: currentTime.toISOString(),
        amount: { currency: 'EUR', value: '3.00' },
        metadata: { did: paymentDid },
        _links: { checkout: { href: `https://checkout.mollie.test/${id}` } },
      }
      payments.set(id, payment)
      return payment
    },
    async getPayment(id) {
      const payment = payments.get(id)
      if (!payment) throw new Error(`unknown payment ${id}`)
      return payment
    },
    async getMandate() {
      return { id: 'mdt_1', status: 'valid' }
    },
    async createSubscription({ idempotencyKey }) {
      const existing = subscriptions.get(idempotencyKey)
      if (existing) return existing
      const subscription = { id: `sub_${++subscriptionCreates}` }
      subscriptions.set(idempotencyKey, subscription)
      return subscription
    },
    async cancelSubscription() {
      cancellationCalls++
    },
  }
  const grants: GrantClient = {
    async put(subjectDid) {
      if (grantFailures > 0) {
        grantFailures--
        throw new Error('Temporary PDS failure')
      }
      memberships.add(subjectDid)
      grantsPut.push(subjectDid)
      return {
        rkey: 'sub-hash',
        uri: 'at://did:plc:issuer/app.bsky.graph.listitem/sub-hash',
      }
    },
    async remove(subjectDid) {
      memberships.delete(subjectDid)
      grantsRemoved.push(subjectDid)
    },
  }
  const app = createDecoService({
    config,
    db,
    mollie,
    grants,
    verifier: {
      async verify() {
        return did
      },
    },
    now: () => currentTime,
  })

  const webhook = (id: string) =>
    app(
      new Request('https://deco.example.com/mollie/webhook', {
        method: 'POST',
        body: `id=${id}`,
      }),
    )

  return {
    db,
    payments,
    memberships,
    grantsPut,
    grantsRemoved,
    counts: () => ({ paymentCreates, subscriptionCreates, cancellationCalls }),
    setTime(value: string) {
      currentTime = new Date(value)
    },
    failNextGrant() {
      grantFailures++
    },
    checkout: () =>
      app(
        new Request(`https://deco.example.com/xrpc/${CREATE_CHECKOUT}`, {
          method: 'POST',
        }),
      ),
    cancel: () =>
      app(
        new Request(`https://deco.example.com/xrpc/${CANCEL}`, {
          method: 'POST',
        }),
      ),
    status: () =>
      app(new Request(`https://deco.example.com/xrpc/${GET_STATUS}`)),
    sweep: () =>
      app(
        new Request('https://deco.example.com/sweep', {
          headers: { authorization: 'Bearer sweep-secret' },
        }),
      ),
    webhook,
    pay(id: string) {
      const payment = payments.get(id)
      assert(payment)
      Object.assign(payment, {
        status: 'paid',
        paidAt: currentTime.toISOString(),
        mandateId: 'mdt_1',
      })
      return webhook(id)
    },
  }
}

Deno.test('service list-item rkeys are isolated by list', async () => {
  const production = await grantRkey(
    'at://did:plc:issuer/app.bsky.graph.list/prod',
    did,
  )
  const test = await grantRkey(
    'at://did:plc:issuer/app.bsky.graph.list/test',
    did,
  )
  assert(production !== test)
})

Deno.test('paidUntilFor handles month ends', () => {
  assertEquals(
    paidUntilFor('2026-01-31T12:00:00.000Z', 1),
    '2026-02-28T12:00:00.000Z',
  )
  assertEquals(
    paidUntilFor('2024-02-29T12:00:00.000Z', 12),
    '2025-02-28T12:00:00.000Z',
  )
})

/** Run regressions against both implementations, including real SQLite SQL. */
const stores = {
  memory: () => ({ db: createMemoryDb(), close() {} }),
  sqlite: () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(SCHEMA)
    const execute = async (sql: string, args: unknown[] = []) => ({
      rows: sqlite.prepare(sql).all(
        ...args as (string | number | null)[],
      ) as Record<string, unknown>[],
    })
    const db = createSqliteDb({
      execute,
      async batch(statements) {
        sqlite.exec('BEGIN IMMEDIATE')
        try {
          const results = []
          for (const statement of statements) {
            results.push(await execute(statement.sql, statement.args))
          }
          sqlite.exec('COMMIT')
          return results
        } catch (error) {
          sqlite.exec('ROLLBACK')
          throw error
        }
      },
    })
    return { db, close: () => sqlite.close() }
  },
}

for (const [name, createStore] of Object.entries(stores)) {
  const test = (
    label: string,
    run: (f: ReturnType<typeof fixture>) => Promise<void>,
  ) => {
    Deno.test(`${name}: ${label}`, async () => {
      const store = createStore()
      try {
        await run(fixture(store.db))
      } finally {
        store.close()
      }
    })
  }

  test('checkout, activation, cancellation and expiry', async (f) => {
    assertEquals((await f.checkout()).status, 200)
    assertEquals(await (await f.checkout()).json(), {
      checkoutUrl: 'https://checkout.mollie.test/tr_1',
    })
    assertEquals(f.counts().paymentCreates, 1)
    assertEquals((await f.pay('tr_1')).status, 200)
    assertEquals((await f.webhook('tr_1')).status, 200)
    assertEquals(f.counts().subscriptionCreates, 1)
    assertEquals(f.grantsPut, [did])
    assertEquals(await (await f.status()).json(), {
      active: true,
      paidUntil: '2026-02-28T12:00:00.000Z',
      cancelAtPeriodEnd: false,
      plan: { amount: '3.00', currency: 'EUR', billingMonths: 1 },
    })
    assertEquals((await f.cancel()).status, 200)
    assertEquals((await f.cancel()).status, 200)
    assertEquals(f.counts().cancellationCalls, 1)
    await f.webhook('tr_1')
    assertEquals((await f.db.get(did))?.status, 'canceling')
    assertEquals((await f.db.get(did))?.cancelAtPeriodEnd, true)
    f.setTime('2026-03-06T12:00:00.000Z')
    assertEquals(await (await f.sweep()).json(), {
      swept: 1,
      failed: 0,
      hasMore: false,
    })
    assertEquals(f.grantsRemoved, [did])
    assertEquals((await f.db.get(did))?.status, 'lapsed')
  })

  test('resubscription replaces a canceled subscription ID', async (f) => {
    await f.checkout()
    await f.pay('tr_1')
    await f.cancel()
    f.setTime('2026-03-06T12:00:00.000Z')
    await f.sweep()
    await f.checkout()
    assertEquals((await f.pay('tr_2')).status, 200)
    assertEquals(f.counts().subscriptionCreates, 2)
    assertEquals((await f.db.get(did))?.subscriptionId, 'sub_2')
    assertEquals((await f.db.get(did))?.cancelAtPeriodEnd, false)
    const before = await f.db.get(did)
    await f.webhook('tr_1')
    assertEquals(await f.db.get(did), before)
  })

  test('processed webhook cannot restore a swept membership', async (f) => {
    await f.checkout()
    await f.pay('tr_1')
    f.setTime('2026-03-06T12:00:00.000Z')
    await f.sweep()
    assertEquals(f.memberships.has(did), false)
    const before = await f.db.get(did)
    assertEquals((await f.webhook('tr_1')).status, 200)
    assertEquals(f.memberships.has(did), false)
    assertEquals(await f.db.get(did), before)
    assertEquals(f.grantsPut, [did])
  })

  test('abandoned checkout does not hide expired membership from sweep', async (f) => {
    await f.checkout()
    await f.pay('tr_1')
    f.setTime('2026-03-01T12:00:00.000Z')
    await f.checkout()
    assertEquals((await f.db.get(did))?.status, 'pending')
    // Keep paid membership throughout the grace period.
    assertEquals((await (await f.sweep()).json()).swept, 0)
    assertEquals(f.memberships.has(did), true)
    f.setTime('2026-03-06T12:00:00.000Z')
    assertEquals((await (await f.sweep()).json()).swept, 1)
    assertEquals(f.memberships.has(did), false)
    assertEquals((await (await f.sweep()).json()).swept, 0)
    // Sweeping must not discard the in-flight checkout.
    assertEquals(await (await f.checkout()).json(), {
      checkoutUrl: 'https://checkout.mollie.test/tr_2',
    })
    assertEquals((await f.pay('tr_2')).status, 200)
    assertEquals(f.memberships.has(did), true)
  })

  test('recurring payment extends entitlement only once', async (f) => {
    await f.checkout()
    await f.pay('tr_1')
    f.setTime('2026-02-28T12:00:00.000Z')
    f.payments.set('tr_recurring', {
      ...f.payments.get('tr_1')!,
      id: 'tr_recurring',
      sequenceType: 'recurring',
      subscriptionId: 'sub_1',
    })
    await f.pay('tr_recurring')
    assertEquals((await f.db.get(did))?.paidUntil, '2026-03-28T12:00:00.000Z')
    await f.webhook('tr_recurring')
    assertEquals(f.grantsPut, [did, did])
    assertEquals(f.counts().subscriptionCreates, 1)
  })

  test('first-payment retry reuses the recurring subscription after a PDS failure', async (f) => {
    await f.checkout()
    f.failNextGrant()
    assertEquals((await f.pay('tr_1')).status, 500)
    assertEquals(await f.db.hasProcessedPayment('tr_1'), false)
    assertEquals((await f.webhook('tr_1')).status, 200)
    assertEquals(f.counts().subscriptionCreates, 1)
    assertEquals(await f.db.hasProcessedPayment('tr_1'), true)
    assertEquals(f.memberships.has(did), true)
  })

  test('membership write failures leave the payment retryable', async (f) => {
    await f.checkout()
    await f.pay('tr_1')
    f.payments.set('tr_recurring', {
      ...f.payments.get('tr_1')!,
      id: 'tr_recurring',
      sequenceType: 'recurring',
      subscriptionId: 'sub_1',
    })
    f.failNextGrant()
    assertEquals((await f.pay('tr_recurring')).status, 500)
    assertEquals(await f.db.hasProcessedPayment('tr_recurring'), false)
    assertEquals((await f.webhook('tr_recurring')).status, 200)
    assertEquals(await f.db.hasProcessedPayment('tr_recurring'), true)
  })
}
