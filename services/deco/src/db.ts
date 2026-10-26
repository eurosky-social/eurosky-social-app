import { createClient } from '@libsql/client/web'

import { env } from './config.ts'
import { type DecoDb, type Subscriber } from './types.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS deco_subscribers (
  did                    TEXT PRIMARY KEY,
  mollie_customer_id     TEXT NOT NULL UNIQUE,
  mollie_subscription_id TEXT,
  checkout_nonce         TEXT,
  checkout_payment_id    TEXT,
  checkout_url           TEXT,
  paid_until             TEXT,
  grant_rkey             TEXT,
  grant_uri              TEXT,
  status                 TEXT NOT NULL,
  cancel_at_period_end   INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deco_subscribers_expiry
  ON deco_subscribers(status, paid_until);
CREATE TABLE IF NOT EXISTS deco_processed_payments (
  payment_id TEXT PRIMARY KEY,
  did        TEXT NOT NULL,
  paid_at    TEXT NOT NULL
);`

type Row = Record<string, unknown>

type SqlClient = {
  execute(sql: string, args?: unknown[]): Promise<{ rows: Row[] }>
  batch(
    statements: { sql: string; args: unknown[] }[],
  ): Promise<{ rows: Row[] }[]>
}

function fromRow(row: Row | undefined): Subscriber | null {
  if (!row) return null
  return {
    did: String(row.did),
    customerId: String(row.mollie_customer_id),
    subscriptionId: row.mollie_subscription_id
      ? String(row.mollie_subscription_id)
      : undefined,
    checkoutNonce: row.checkout_nonce ? String(row.checkout_nonce) : undefined,
    checkoutPaymentId: row.checkout_payment_id
      ? String(row.checkout_payment_id)
      : undefined,
    checkoutUrl: row.checkout_url ? String(row.checkout_url) : undefined,
    paidUntil: row.paid_until ? String(row.paid_until) : undefined,
    grantRkey: row.grant_rkey ? String(row.grant_rkey) : undefined,
    grantUri: row.grant_uri ? String(row.grant_uri) : undefined,
    status: String(row.status) as Subscriber['status'],
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

const SELECT = `SELECT did, mollie_customer_id, mollie_subscription_id,
  checkout_nonce, checkout_payment_id, checkout_url, paid_until, grant_rkey,
  grant_uri, status, cancel_at_period_end, created_at, updated_at
  FROM deco_subscribers`

export function createSqliteDb(sql: SqlClient): DecoDb {
  return {
    async get(did) {
      const { rows } = await sql.execute(`${SELECT} WHERE did = ?`, [did])
      return fromRow(rows[0])
    },
    async getByCustomerId(customerId) {
      const { rows } = await sql.execute(
        `${SELECT} WHERE mollie_customer_id = ?`,
        [customerId],
      )
      return fromRow(rows[0])
    },
    async putCustomer(did, customerId, now) {
      await sql.execute(
        `INSERT INTO deco_subscribers
           (did, mollie_customer_id, status, cancel_at_period_end, created_at, updated_at)
         VALUES (?, ?, 'lapsed', 0, ?, ?)
         ON CONFLICT(did) DO UPDATE SET
           mollie_customer_id = excluded.mollie_customer_id,
           updated_at = excluded.updated_at`,
        [did, customerId, now, now],
      )
      return (await this.get(did))!
    },
    async beginCheckout({ did, customerId, nonce, now }) {
      await sql.execute(
        `UPDATE deco_subscribers SET
           mollie_customer_id = ?, checkout_nonce = ?,
           checkout_payment_id = NULL, checkout_url = NULL,
           status = 'pending', cancel_at_period_end = 0, updated_at = ?
         WHERE did = ?`,
        [customerId, nonce, now, did],
      )
    },
    async setPendingCheckout({ did, paymentId, checkoutUrl, now }) {
      await sql.execute(
        `UPDATE deco_subscribers SET checkout_payment_id = ?, checkout_url = ?,
           status = 'pending', updated_at = ? WHERE did = ?`,
        [paymentId, checkoutUrl, now, did],
      )
    },
    async clearCheckout(did, now) {
      await sql.execute(
        `UPDATE deco_subscribers SET checkout_nonce = NULL,
           checkout_payment_id = NULL, checkout_url = NULL,
           status = CASE WHEN paid_until > ? THEN status ELSE 'lapsed' END,
           updated_at = ? WHERE did = ?`,
        [now, now, did],
      )
    },
    async applyPaidPayment(payment) {
      await sql.batch([
        {
          sql: `INSERT OR IGNORE INTO deco_processed_payments
                  (payment_id, did, paid_at) VALUES (?, ?, ?)`,
          args: [payment.paymentId, payment.did, payment.paidAt],
        },
        {
          sql: `UPDATE deco_subscribers SET
                  mollie_customer_id = ?,
                  mollie_subscription_id = COALESCE(?, mollie_subscription_id),
                  paid_until = CASE
                    WHEN paid_until IS NULL OR paid_until < ? THEN ?
                    ELSE paid_until END,
                  grant_rkey = ?, grant_uri = ?,
                  status = CASE WHEN cancel_at_period_end = 1
                    THEN 'canceling' ELSE 'active' END,
                  checkout_nonce = NULL,
                  checkout_payment_id = NULL, checkout_url = NULL,
                  updated_at = ?
                WHERE did = ?`,
          args: [
            payment.customerId,
            payment.subscriptionId ?? null,
            payment.paidUntil,
            payment.paidUntil,
            payment.grantRkey,
            payment.grantUri,
            payment.paidAt,
            payment.did,
          ],
        },
      ])
    },
    async markCanceling(did, now) {
      await sql.execute(
        `UPDATE deco_subscribers SET status = 'canceling',
           cancel_at_period_end = 1, updated_at = ? WHERE did = ?`,
        [now, did],
      )
    },
    async markLapsed(did, now) {
      await sql.execute(
        `UPDATE deco_subscribers SET status = 'lapsed',
           cancel_at_period_end = 0, grant_rkey = NULL, grant_uri = NULL,
           updated_at = ? WHERE did = ?`,
        [now, did],
      )
    },
    async listExpired(cutoff, limit) {
      const { rows } = await sql.execute(
        `${SELECT} WHERE status IN ('active', 'canceling')
          AND paid_until IS NOT NULL AND paid_until <= ?
          AND grant_uri IS NOT NULL ORDER BY paid_until ASC LIMIT ?`,
        [cutoff, limit],
      )
      return rows.map((row) => fromRow(row)!)
    },
  }
}

export function createMemoryDb(): DecoDb {
  const subscribers = new Map<string, Subscriber>()

  const clone = (value: Subscriber): Subscriber => ({ ...value })
  const save = (value: Subscriber) => subscribers.set(value.did, clone(value))

  return {
    async get(did) {
      const value = subscribers.get(did)
      return value ? clone(value) : null
    },
    async getByCustomerId(customerId) {
      const value = [...subscribers.values()].find(
        (item) => item.customerId === customerId,
      )
      return value ? clone(value) : null
    },
    async putCustomer(did, customerId, now) {
      const existing = subscribers.get(did)
      const value: Subscriber = existing
        ? { ...existing, customerId, updatedAt: now }
        : {
          did,
          customerId,
          status: 'lapsed',
          cancelAtPeriodEnd: false,
          createdAt: now,
          updatedAt: now,
        }
      save(value)
      return clone(value)
    },
    async beginCheckout({ did, customerId, nonce, now }) {
      const value = subscribers.get(did)
      if (!value) throw new Error(`Subscriber ${did} does not exist`)
      save({
        ...value,
        customerId,
        checkoutNonce: nonce,
        checkoutPaymentId: undefined,
        checkoutUrl: undefined,
        status: 'pending',
        cancelAtPeriodEnd: false,
        updatedAt: now,
      })
    },
    async setPendingCheckout({ did, paymentId, checkoutUrl, now }) {
      const value = subscribers.get(did)
      if (!value) throw new Error(`Subscriber ${did} does not exist`)
      save({
        ...value,
        checkoutPaymentId: paymentId,
        checkoutUrl,
        status: 'pending',
        updatedAt: now,
      })
    },
    async clearCheckout(did, now) {
      const value = subscribers.get(did)
      if (!value) return
      save({
        ...value,
        checkoutNonce: undefined,
        checkoutPaymentId: undefined,
        checkoutUrl: undefined,
        status: value.paidUntil && value.paidUntil > now
          ? value.status
          : 'lapsed',
        updatedAt: now,
      })
    },
    async applyPaidPayment(payment) {
      const value = subscribers.get(payment.did)
      if (!value) throw new Error(`Subscriber ${payment.did} does not exist`)
      save({
        ...value,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId ?? value.subscriptionId,
        paidUntil: !value.paidUntil || value.paidUntil < payment.paidUntil
          ? payment.paidUntil
          : value.paidUntil,
        grantRkey: payment.grantRkey,
        grantUri: payment.grantUri,
        status: value.cancelAtPeriodEnd ? 'canceling' : 'active',
        checkoutNonce: undefined,
        checkoutPaymentId: undefined,
        checkoutUrl: undefined,
        updatedAt: payment.paidAt,
      })
    },
    async markCanceling(did, now) {
      const value = subscribers.get(did)
      if (!value) return
      save({
        ...value,
        status: 'canceling',
        cancelAtPeriodEnd: true,
        updatedAt: now,
      })
    },
    async markLapsed(did, now) {
      const value = subscribers.get(did)
      if (!value) return
      save({
        ...value,
        status: 'lapsed',
        cancelAtPeriodEnd: false,
        grantRkey: undefined,
        grantUri: undefined,
        updatedAt: now,
      })
    },
    async listExpired(cutoff, limit) {
      return [...subscribers.values()]
        .filter(
          (value) =>
            (value.status === 'active' || value.status === 'canceling') &&
            !!value.paidUntil &&
            value.paidUntil <= cutoff &&
            !!value.grantUri,
        )
        .sort((a, b) => a.paidUntil!.localeCompare(b.paidUntil!))
        .slice(0, limit)
        .map(clone)
    },
  }
}

let singleton: Promise<DecoDb> | undefined

export function getDb(): Promise<DecoDb> {
  return (singleton ??= createConfiguredDb())
}

async function createConfiguredDb(): Promise<DecoDb> {
  const url = env('DB_URL')
  const authToken = env('DB_TOKEN')
  if (!url) {
    console.warn('[deco] DB_URL unset - using ephemeral in-memory storage')
    return createMemoryDb()
  }

  const client = createClient({ url, authToken })
  for (
    const statement of SCHEMA.split(';').map((sql) => sql.trim()).filter(
      Boolean,
    )
  ) {
    await client.execute(statement)
  }
  const sql: SqlClient = {
    async execute(statement, args = []) {
      const result = await client.execute({
        sql: statement,
        args: args as never[],
      })
      return { rows: result.rows as unknown as Row[] }
    },
    async batch(statements) {
      const results = await client.batch(
        statements.map((statement) => ({
          sql: statement.sql,
          args: statement.args as never[],
        })),
        'write',
      )
      return results.map((result) => ({
        rows: result.rows as unknown as Row[],
      }))
    },
  }
  return createSqliteDb(sql)
}
