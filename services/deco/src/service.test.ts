import { type DecoConfig } from './config.ts'
import { createMemoryDb } from './db.ts'
import { grantRkey } from './grants.ts'
import {
  CANCEL,
  CREATE_CHECKOUT,
  createDecoService,
  GET_STATUS,
  paidUntilFor,
} from './service.ts'
import {
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
  mollieDescription: 'Decorations',
  billingMonths: 1,
  checkoutRedirectUrl: 'https://example.com/settings/decorations',
  issuerPdsUrl: 'https://pds.example.com',
  issuerIdentifier: 'issuer.example.com',
  issuerAppPassword: 'xxxx-xxxx-xxxx-xxxx',
  issuerDid: 'did:plc:issuer',
  subscriberListUri: 'at://did:plc:issuer/app.bsky.graph.list/subscribers',
  sweepSecret: 'sweep-secret',
  graceDays: 5,
}

Deno.test('service list-item rkeys are isolated by list', async () => {
  const subject = 'did:plc:subscriber'
  const production = await grantRkey(
    'at://did:plc:issuer/app.bsky.graph.list/prod',
    subject,
  )
  const test = await grantRkey(
    'at://did:plc:issuer/app.bsky.graph.list/test',
    subject,
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

Deno.test('checkout, paid webhook, cancellation, and expiry lifecycle', async () => {
  const did = 'did:plc:subscriber'
  const db = createMemoryDb()
  let currentTime = new Date('2026-01-31T12:00:00.000Z')
  let paymentCreates = 0
  let subscriptionCreates = 0
  let cancellationCalls = 0
  const payments = new Map<string, MolliePayment>()

  const mollie: MollieClient = {
    async createCustomer() {
      return { id: 'cst_1' }
    },
    async createFirstPayment({ did: paymentDid, customerId }) {
      paymentCreates++
      const payment: MolliePayment = {
        id: 'tr_1',
        status: 'open',
        sequenceType: 'first',
        customerId,
        createdAt: currentTime.toISOString(),
        amount: { currency: 'EUR', value: '3.00' },
        metadata: { did: paymentDid },
        _links: { checkout: { href: 'https://checkout.mollie.test/tr_1' } },
      }
      payments.set(payment.id, payment)
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
    async createSubscription() {
      subscriptionCreates++
      return { id: 'sub_1' }
    },
    async cancelSubscription() {
      cancellationCalls++
    },
  }

  const grantsPut: string[] = []
  const grantsRemoved: string[] = []
  const grants: GrantClient = {
    async put(subjectDid) {
      grantsPut.push(subjectDid)
      return {
        rkey: 'sub-hash',
        uri: `at://did:plc:issuer/app.bsky.graph.listitem/sub-hash`,
      }
    },
    async remove(subjectDid) {
      grantsRemoved.push(subjectDid)
    },
  }

  const app = createDecoService({
    config,
    db,
    mollie,
    grants,
    verifier: {
      async verify(request) {
        return request.headers.get('x-did') || did
      },
    },
    now: () => currentTime,
    randomId: () => 'checkout-nonce',
  })

  const checkoutRequest = () =>
    new Request(`https://deco.example.com/xrpc/${CREATE_CHECKOUT}`, {
      method: 'POST',
      headers: { 'x-did': did },
    })
  const firstCheckout = await app(checkoutRequest())
  assertEquals(firstCheckout.status, 200)
  assertEquals(await firstCheckout.json(), {
    checkoutUrl: 'https://checkout.mollie.test/tr_1',
  })

  const reusedCheckout = await app(checkoutRequest())
  assertEquals(reusedCheckout.status, 200)
  assertEquals(paymentCreates, 1)

  payments.set('tr_1', {
    ...payments.get('tr_1')!,
    status: 'paid',
    paidAt: currentTime.toISOString(),
    mandateId: 'mdt_1',
  })
  const webhookRequest = () =>
    new Request('https://deco.example.com/mollie/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'id=tr_1',
    })
  assertEquals((await app(webhookRequest())).status, 200)
  assertEquals((await app(webhookRequest())).status, 200)
  assertEquals(subscriptionCreates, 1)
  assertEquals(grantsPut, [did, did])

  const subscriber = await db.get(did)
  assert(subscriber)
  assertEquals(subscriber.status, 'active')
  assertEquals(subscriber.subscriptionId, 'sub_1')
  assertEquals(subscriber.paidUntil, '2026-02-28T12:00:00.000Z')

  const status = await app(
    new Request(`https://deco.example.com/xrpc/${GET_STATUS}`, {
      headers: { 'x-did': did },
    }),
  )
  assertEquals(await status.json(), {
    active: true,
    paidUntil: '2026-02-28T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    plan: { amount: '3.00', currency: 'EUR', billingMonths: 1 },
  })

  const canceled = await app(
    new Request(`https://deco.example.com/xrpc/${CANCEL}`, {
      method: 'POST',
      headers: { 'x-did': did },
    }),
  )
  assertEquals(canceled.status, 200)
  assertEquals(cancellationCalls, 1)
  assertEquals((await db.get(did))?.cancelAtPeriodEnd, true)

  // A delayed duplicate of the paid webhook must not undo cancellation.
  assertEquals((await app(webhookRequest())).status, 200)
  assertEquals((await db.get(did))?.cancelAtPeriodEnd, true)
  assertEquals((await db.get(did))?.status, 'canceling')

  currentTime = new Date('2026-03-06T12:00:00.000Z')
  const sweep = await app(
    new Request('https://deco.example.com/sweep', {
      headers: { authorization: 'Bearer sweep-secret' },
    }),
  )
  assertEquals(sweep.status, 200)
  assertEquals(await sweep.json(), { swept: 1, failed: 0, hasMore: false })
  assertEquals(grantsRemoved, [did])
  assertEquals((await db.get(did))?.status, 'lapsed')
})
