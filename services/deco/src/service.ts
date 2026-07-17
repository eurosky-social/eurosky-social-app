import { type DecoConfig } from './config.ts'
import { grantRkey } from './grants.ts'
import {
  type CallerVerifier,
  type DecoDb,
  type GrantClient,
  type MollieClient,
  type MolliePayment,
  type Subscriber,
} from './types.ts'

export const GET_STATUS = 'social.mu.deco.getStatus'
export const CREATE_CHECKOUT = 'social.mu.deco.createCheckout'
export const CANCEL = 'social.mu.deco.cancel'

const MAX_WEBHOOK_BODY = 8 * 1024
const SWEEP_LIMIT = 100

export type ServiceDependencies = {
  config: DecoConfig
  db: DecoDb
  mollie: MollieClient
  grants: GrantClient
  verifier: CallerVerifier
  now?: () => Date
  randomId?: () => string
}

class HttpError extends Error {
  constructor(
    public status: number,
    public error: string,
    message: string,
  ) {
    super(message)
  }
}

function addBillingMonths(value: Date, months: number): Date {
  const next = new Date(value)
  const day = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))
  return next
}

export function paidUntilFor(paidAt: string, billingMonths: number): string {
  const date = new Date(paidAt)
  if (Number.isNaN(date.valueOf())) throw new Error('Invalid Mollie paidAt')
  return addBillingMonths(date, billingMonths).toISOString()
}

function metadataDid(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const did = (metadata as Record<string, unknown>).did
  return typeof did === 'string' && did.startsWith('did:') ? did : undefined
}

function isCheckoutPending(payment: MolliePayment): boolean {
  return payment.status === 'open' || payment.status === 'pending'
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

async function idempotencyKey(prefix: string, value: string): Promise<string> {
  return `${prefix}-${await grantRkey(value)}`
}

export function createDecoService(deps: ServiceDependencies) {
  const now = deps.now || (() => new Date())
  const randomId = deps.randomId || (() => crypto.randomUUID())
  const cors = {
    'access-control-allow-origin': deps.config.allowedOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
  }

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...cors,
      },
    })
  }

  function statusBody(subscriber: Subscriber | null) {
    const paidUntil = subscriber?.paidUntil
    return {
      active: !!paidUntil && paidUntil > now().toISOString(),
      ...(paidUntil ? { paidUntil } : {}),
      cancelAtPeriodEnd: !!subscriber?.cancelAtPeriodEnd,
    }
  }

  async function getStatus(request: Request): Promise<Response> {
    const did = await deps.verifier.verify(request, GET_STATUS)
    return json(statusBody(await deps.db.get(did)))
  }

  async function createCheckout(request: Request): Promise<Response> {
    const did = await deps.verifier.verify(request, CREATE_CHECKOUT)
    let subscriber = await deps.db.get(did)
    if (statusBody(subscriber).active) {
      throw new HttpError(
        409,
        'SubscriptionActive',
        'The subscription is already active',
      )
    }

    if (subscriber?.checkoutPaymentId) {
      const payment = await deps.mollie.getPayment(
        subscriber.checkoutPaymentId,
      )
      if (isCheckoutPending(payment)) {
        const checkoutUrl = payment._links?.checkout?.href ||
          subscriber.checkoutUrl
        if (checkoutUrl) return json({ checkoutUrl })
      }
      if (payment.status === 'paid') {
        throw new HttpError(
          409,
          'PaymentProcessing',
          'The payment is being activated',
        )
      }
      await deps.db.clearCheckout(did, now().toISOString())
      subscriber = await deps.db.get(did)
    }

    let customerId = subscriber?.customerId
    if (!customerId) {
      const customer = await deps.mollie.createCustomer(
        did,
        await idempotencyKey('customer', did),
      )
      customerId = customer.id
      subscriber = await deps.db.putCustomer(
        did,
        customerId,
        now().toISOString(),
      )
    }

    const nonce = subscriber?.checkoutNonce || randomId()
    await deps.db.beginCheckout({
      did,
      customerId,
      nonce,
      now: now().toISOString(),
    })
    const payment = await deps.mollie.createFirstPayment({
      did,
      customerId,
      idempotencyKey: `checkout-${nonce}`,
    })
    const checkoutUrl = payment._links?.checkout?.href
    if (!checkoutUrl) {
      throw new Error('Mollie payment did not include a checkout URL')
    }
    await deps.db.setPendingCheckout({
      did,
      paymentId: payment.id,
      checkoutUrl,
      now: now().toISOString(),
    })
    return json({ checkoutUrl })
  }

  async function cancel(request: Request): Promise<Response> {
    const did = await deps.verifier.verify(request, CANCEL)
    const subscriber = await deps.db.get(did)
    if (!subscriber?.subscriptionId || !statusBody(subscriber).active) {
      throw new HttpError(
        409,
        'SubscriptionInactive',
        'There is no active subscription to cancel',
      )
    }
    if (!subscriber.cancelAtPeriodEnd) {
      await deps.mollie.cancelSubscription(
        subscriber.customerId,
        subscriber.subscriptionId,
      )
      await deps.db.markCanceling(did, now().toISOString())
    }
    return json(statusBody(await deps.db.get(did)))
  }

  async function webhookPayment(request: Request): Promise<Response> {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_WEBHOOK_BODY) {
      throw new HttpError(413, 'InvalidRequest', 'Webhook body is too large')
    }
    const raw = await request.text()
    if (raw.length > MAX_WEBHOOK_BODY) {
      throw new HttpError(413, 'InvalidRequest', 'Webhook body is too large')
    }

    let paymentId: string | undefined
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = JSON.parse(raw) as { id?: unknown }
      if (typeof body.id === 'string') paymentId = body.id
    } else {
      paymentId = new URLSearchParams(raw).get('id') || undefined
    }
    if (!paymentId) {
      throw new HttpError(400, 'InvalidRequest', 'Missing Mollie payment id')
    }

    // Mollie webhooks carry only an object id. Re-fetching it with our API key
    // is the authenticity check; no caller-supplied payment details are trusted.
    const payment = await deps.mollie.getPayment(paymentId)
    const reversedAmount = Math.max(
      Number(payment.amountChargedBack?.value || 0),
      Number(payment.amountRefunded?.value || 0),
    )
    if (payment.status !== 'paid' || reversedAmount > 0) {
      // Failed/reversed payments never extend entitlement. Existing paid time
      // is left untouched and the sweep removes its grant after expiry.
      return json({ received: true })
    }
    if (
      payment.amount.currency !== deps.config.mollieCurrency ||
      payment.amount.value !== deps.config.mollieAmount
    ) {
      throw new HttpError(
        400,
        'UnexpectedPayment',
        'Payment amount does not match the subscription price',
      )
    }

    const didFromMetadata = metadataDid(payment.metadata)
    let subscriber = didFromMetadata ? await deps.db.get(didFromMetadata) : null
    if (!subscriber && payment.customerId) {
      subscriber = await deps.db.getByCustomerId(payment.customerId)
    }
    if (
      !subscriber ||
      !payment.customerId ||
      subscriber.customerId !== payment.customerId
    ) {
      throw new HttpError(
        400,
        'UnknownPayment',
        'Payment is not associated with a decoration checkout',
      )
    }

    const isFirst = payment.sequenceType === 'first' ||
      payment.id === subscriber.checkoutPaymentId
    let subscriptionId = payment.subscriptionId || subscriber.subscriptionId
    const paidAt = payment.paidAt
    if (!paidAt) throw new Error('Paid Mollie payment has no paidAt timestamp')
    const paidUntil = paidUntilFor(paidAt, deps.config.billingMonths)

    if (isFirst && !subscriptionId) {
      if (!payment.mandateId) {
        throw new Error('First Mollie payment has no mandate')
      }
      const mandate = await deps.mollie.getMandate(
        payment.customerId,
        payment.mandateId,
      )
      if (mandate.status !== 'valid') {
        throw new HttpError(
          503,
          'MandatePending',
          'The payment mandate is not valid yet',
        )
      }
      const subscription = await deps.mollie.createSubscription({
        did: subscriber.did,
        customerId: payment.customerId,
        startDate: paidUntil.slice(0, 10),
        idempotencyKey: `subscription-${payment.id}`,
      })
      subscriptionId = subscription.id
    }

    const grant = await deps.grants.put(subscriber.did)
    await deps.db.applyPaidPayment({
      paymentId: payment.id,
      did: subscriber.did,
      customerId: payment.customerId,
      subscriptionId,
      paidUntil,
      grantRkey: grant.rkey,
      grantUri: grant.uri,
      paidAt,
    })
    return json({ received: true })
  }

  async function sweep(request: Request): Promise<Response> {
    const supplied = request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
    if (!supplied || !safeEqual(supplied, deps.config.sweepSecret)) {
      throw new HttpError(401, 'AuthRequired', 'Invalid sweep token')
    }

    const cutoff = new Date(
      now().valueOf() - deps.config.graceDays * 24 * 60 * 60 * 1000,
    ).toISOString()
    const expired = await deps.db.listExpired(cutoff, SWEEP_LIMIT)
    const failures: string[] = []
    let swept = 0
    for (const subscriber of expired) {
      try {
        await deps.grants.remove(subscriber.did, subscriber.grantRkey)
        await deps.db.markLapsed(subscriber.did, now().toISOString())
        swept++
      } catch (error) {
        failures.push(subscriber.did)
        console.error('[deco] failed to revoke expired grant', {
          did: subscriber.did,
          error,
        })
      }
    }
    return json({
      swept,
      failed: failures.length,
      hasMore: expired.length === SWEEP_LIMIT,
    })
  }

  return async function fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    const { pathname } = new URL(request.url)

    try {
      if (pathname === '/.well-known/did.json' && request.method === 'GET') {
        return json({
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: deps.config.serviceDid,
        })
      }
      if (pathname === '/xrpc/_health' && request.method === 'GET') {
        return json({ status: 'ok' })
      }
      if (pathname === `/xrpc/${GET_STATUS}` && request.method === 'GET') {
        return await getStatus(request)
      }
      if (
        pathname === `/xrpc/${CREATE_CHECKOUT}` &&
        request.method === 'POST'
      ) {
        return await createCheckout(request)
      }
      if (pathname === `/xrpc/${CANCEL}` && request.method === 'POST') {
        return await cancel(request)
      }
      if (pathname === '/mollie/webhook' && request.method === 'POST') {
        return await webhookPayment(request)
      }
      if (pathname === '/sweep' && request.method === 'GET') {
        return await sweep(request)
      }
      return json({ error: 'NotFound', message: 'Route not found' }, 404)
    } catch (error) {
      if (error instanceof HttpError) {
        return json(
          { error: error.error, message: error.message },
          error.status,
        )
      }
      const status = typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : 500
      if (status >= 500) console.error('[deco] handler error', error)
      return json(
        {
          error: status === 401 ? 'AuthRequired' : 'InternalServerError',
          message: status === 401
            ? 'Authentication failed'
            : 'The service failed',
        },
        status === 401 || status === 403 ? status : 500,
      )
    }
  }
}
