export type SubscriberStatus = 'pending' | 'active' | 'canceling' | 'lapsed'

export type Subscriber = {
  did: string
  customerId: string
  subscriptionId?: string
  checkoutNonce?: string
  checkoutPaymentId?: string
  checkoutUrl?: string
  paidUntil?: string
  grantRkey?: string
  grantUri?: string
  status: SubscriberStatus
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

export type PaidPayment = {
  paymentId: string
  did: string
  customerId: string
  subscriptionId?: string
  paidUntil: string
  grantRkey: string
  grantUri: string
  paidAt: string
}

export interface DecoDb {
  get(did: string): Promise<Subscriber | null>
  getByCustomerId(customerId: string): Promise<Subscriber | null>
  putCustomer(did: string, customerId: string, now: string): Promise<Subscriber>
  beginCheckout(args: {
    did: string
    customerId: string
    nonce: string
    now: string
  }): Promise<void>
  setPendingCheckout(args: {
    did: string
    paymentId: string
    checkoutUrl: string
    now: string
  }): Promise<void>
  clearCheckout(did: string, now: string): Promise<void>
  applyPaidPayment(payment: PaidPayment): Promise<void>
  markCanceling(did: string, now: string): Promise<void>
  markLapsed(did: string, now: string): Promise<void>
  listExpired(cutoff: string, limit: number): Promise<Subscriber[]>
}

export type MollieLink = { href: string }

export type MolliePayment = {
  id: string
  status: string
  sequenceType?: 'oneoff' | 'first' | 'recurring'
  customerId?: string
  subscriptionId?: string
  mandateId?: string
  createdAt: string
  paidAt?: string
  amount: { currency: string; value: string }
  amountChargedBack?: { currency: string; value: string }
  amountRefunded?: { currency: string; value: string }
  metadata?: unknown
  _links?: { checkout?: MollieLink }
}

export type MollieMandate = {
  id: string
  status: 'valid' | 'pending' | 'invalid'
}

export interface MollieClient {
  createCustomer(did: string, idempotencyKey: string): Promise<{ id: string }>
  createFirstPayment(args: {
    did: string
    customerId: string
    idempotencyKey: string
  }): Promise<MolliePayment>
  getPayment(id: string): Promise<MolliePayment>
  getMandate(customerId: string, mandateId: string): Promise<MollieMandate>
  createSubscription(args: {
    did: string
    customerId: string
    startDate: string
    idempotencyKey: string
  }): Promise<{ id: string }>
  cancelSubscription(customerId: string, subscriptionId: string): Promise<void>
}

export interface GrantClient {
  put(subjectDid: string): Promise<{ rkey: string; uri: string }>
  remove(subjectDid: string, rkey?: string): Promise<void>
}

export interface CallerVerifier {
  verify(request: Request, lxm: string): Promise<string>
}
