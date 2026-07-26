import { type DecoConfig } from './config.ts'
import {
  type MollieClient,
  type MollieMandate,
  type MolliePayment,
} from './types.ts'

const MOLLIE_API = 'https://api.mollie.com/v2'

export class MollieApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export function createMollieClient(config: DecoConfig): MollieClient {
  async function request<T>(
    path: string,
    init: RequestInit = {},
    idempotencyKey?: string,
  ): Promise<T> {
    const response = await fetch(`${MOLLIE_API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${config.mollieApiKey}`,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...init.headers,
      },
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new MollieApiError(
        `Mollie ${init.method || 'GET'} ${path} failed (${response.status}): ${
          body.slice(0, 500)
        }`,
        response.status,
      )
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  const amount = {
    currency: config.mollieCurrency,
    value: config.mollieAmount,
  }
  const webhookUrl = `${config.publicUrl}/mollie/webhook`
  const interval = config.billingMonths === 1
    ? '1 month'
    : `${config.billingMonths} months`

  return {
    createCustomer(did, idempotencyKey) {
      return request<{ id: string }>(
        '/customers',
        {
          method: 'POST',
          body: JSON.stringify({
            name: did,
            metadata: { did, product: 'deco' },
          }),
        },
        idempotencyKey,
      )
    },
    createFirstPayment({ did, customerId, idempotencyKey }) {
      return request<MolliePayment>(
        '/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            amount,
            customerId,
            sequenceType: 'first',
            description: config.mollieDescription,
            redirectUrl: config.checkoutRedirectUrl,
            webhookUrl,
            metadata: { did, product: 'deco', kind: 'first' },
          }),
        },
        idempotencyKey,
      )
    },
    getPayment(id) {
      return request<MolliePayment>(`/payments/${encodeURIComponent(id)}`)
    },
    getMandate(customerId, mandateId) {
      return request<MollieMandate>(
        `/customers/${encodeURIComponent(customerId)}/mandates/${
          encodeURIComponent(mandateId)
        }`,
      )
    },
    createSubscription({ did, customerId, startDate, idempotencyKey }) {
      return request<{ id: string }>(
        `/customers/${encodeURIComponent(customerId)}/subscriptions`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount,
            interval,
            startDate,
            description: config.mollieDescription,
            webhookUrl,
            metadata: { did, product: 'deco' },
          }),
        },
        idempotencyKey,
      )
    },
    async cancelSubscription(customerId, subscriptionId) {
      try {
        await request<void>(
          `/customers/${encodeURIComponent(customerId)}/subscriptions/${
            encodeURIComponent(subscriptionId)
          }`,
          { method: 'DELETE' },
        )
      } catch (error) {
        // A repeated cancel or a dashboard-side cancellation is already in the
        // desired state. Keep the endpoint idempotent.
        if (error instanceof MollieApiError && error.status === 404) return
        throw error
      }
    },
  }
}
