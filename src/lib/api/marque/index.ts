/** Marque Partner API and portable repository-record helpers. */
import {
  type Client,
  type DidString,
  type Service,
  XrpcResponseError,
} from '@atproto/lex'

import {
  checkAvailability as checkAvailabilitySchema,
  createCheckout as createCheckoutSchema,
  getOrder as getOrderSchema,
  getRequirements as getRequirementsSchema,
  listPricing as listPricingSchema,
} from './schemas'

export const MARQUE_REGISTRAR: Service = 'did:web:marque.at#marque_registrar'

const proxyToMarque = {service: MARQUE_REGISTRAR} as const

export type TldPricing = {
  tld: string
  registerPrice: number
  renewPrice: number
  transferPrice: number
  popular?: boolean
  transferAddsYear?: boolean
  whoisPrivacyAllowed?: boolean
  minPeriod?: number
  maxPeriod?: number
}

export type AvailabilityResult = {
  domain: string
  available?: boolean
  status?: string
  price?: number
  renewPrice?: number
  transferPrice?: number
  premiumPrice?: number
  isPremium?: boolean
  transferAddsYear?: boolean
  minPeriod?: number
  maxPeriod?: number
  whoisPrivacyAllowed?: boolean
  error?: string
}

export type PaymentMethod = 'stripe' | 'paypal' | 'nowpayments'

export type DomainRequirement = {
  domain: string
  passportNumberRequired: boolean
  companyRegistrationNumberRequired: boolean
  taxNumberRequired: boolean
  additionalData: RequirementSpec[]
  customerAdditionalData: RequirementSpec[]
}

export type RequirementSpec = {
  name: string
  description: string
  required: boolean
  type: string
  pattern?: string
  syntax?: string
  options?: {description: string; value: string; requires?: string[]}[]
}

export type CheckoutItem = {
  domain: string
  years?: number
  whoisPrivacy?: boolean
  autoRenew?: boolean
}

export type Registrant = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneSubscriber: string
  street: string
  city: string
  zipcode: string
  country: string
  state?: string
  organization?: string
  phoneAreaCode?: string
  taxIdType?: string
  taxIdValue?: string
  companyRegistrationNumber?: string
  passportNumber?: string
  socialSecurityNumber?: string
}

export type CheckoutResponse = {
  orderId: string
  checkoutUrl: string
  subtotalCents: number
  taxCents?: number
  totalCents: number
  currency: string
  paymentMethod?: string
}

export type OrderItem = {
  domain: string
  status: string
  registeredAt?: string
  expiresAt?: string
  nameServers?: string[]
  error?: string
}

export const ORDER_ACTIVE = 'provisioned'
export const ORDER_FAILED = 'failed'
export const ITEM_ACTIVE = 'active'
export const ITEM_FAILED = 'failed'

export type Order = {
  orderId: string
  status: string
  paidAt?: string
  checkoutUrl?: string
  error?: string
  items: OrderItem[]
}

export type ProvisionedDomain = {
  domain: string
  registeredAt?: string
  expiresAt?: string
  nameServers: string[]
}

export type MarqueDomainRecord = {
  uri: string
  cid: string
  domain: string
  status: string
  nameServers: string[]
}

export type MarqueDnsEntry = {
  name: string
  recordType: string
  value: string
  ttl: number
  priority?: number
}

export type MarqueDnsRecord = {
  uri: string
  cid: string
  domain: string
  subject: {uri: string; cid: string}
  records: MarqueDnsEntry[]
}

function isRecordNotFound(error: unknown) {
  return (
    error instanceof XrpcResponseError &&
    (error.error === 'RecordNotFound' || error.status === 404)
  )
}

function parseDomainRecord(record: {
  uri: string
  cid: string
  value: Record<string, unknown>
}): MarqueDomainRecord | null {
  const {value} = record
  if (
    value.$type !== 'at.marque.domain' ||
    typeof value.domain !== 'string' ||
    typeof value.status !== 'string'
  ) {
    return null
  }
  return {
    uri: record.uri,
    cid: record.cid,
    domain: value.domain,
    status: value.status,
    nameServers: Array.isArray(value.nameServers)
      ? value.nameServers.filter((v): v is string => typeof v === 'string')
      : [],
  }
}

function parseDnsRecord(record: {
  uri: string
  cid: string
  value: Record<string, unknown>
}): MarqueDnsRecord | null {
  const {value} = record
  if (
    value.$type !== 'at.marque.dns' ||
    typeof value.domain !== 'string' ||
    !value.subject ||
    typeof value.subject !== 'object' ||
    !('uri' in value.subject) ||
    !('cid' in value.subject) ||
    typeof value.subject.uri !== 'string' ||
    typeof value.subject.cid !== 'string'
  ) {
    return null
  }
  const records: MarqueDnsEntry[] = []
  const rawRecords: unknown[] = Array.isArray(value.records)
    ? value.records
    : []
  for (const item of rawRecords) {
    if (
      item &&
      typeof item === 'object' &&
      'name' in item &&
      'recordType' in item &&
      'value' in item &&
      'ttl' in item &&
      typeof item.name === 'string' &&
      typeof item.recordType === 'string' &&
      typeof item.value === 'string' &&
      typeof item.ttl === 'number'
    ) {
      records.push({
        name: item.name,
        recordType: item.recordType,
        value: item.value,
        ttl: item.ttl,
        priority:
          'priority' in item && typeof item.priority === 'number'
            ? item.priority
            : undefined,
      })
    }
  }
  return {
    uri: record.uri,
    cid: record.cid,
    domain: value.domain,
    subject: {uri: value.subject.uri, cid: value.subject.cid},
    records,
  }
}

/** Read one Marque-owned domain record by its FQDN record key. */
export async function getMarqueDomainRecord(
  client: Client,
  did: DidString,
  domain: string,
): Promise<MarqueDomainRecord | null> {
  try {
    const res = await client.getRecord('at.marque.domain', domain, {repo: did})
    if (!res.body.cid) return null
    return parseDomainRecord({
      uri: res.body.uri,
      cid: res.body.cid,
      value: res.body.value,
    })
  } catch (error) {
    if (isRecordNotFound(error)) return null
    throw error
  }
}

/** Read one Marque DNS zone record by the matching domain record key. */
export async function getMarqueDnsRecord(
  client: Client,
  did: DidString,
  domain: string,
): Promise<MarqueDnsRecord | null> {
  try {
    const res = await client.getRecord('at.marque.dns', domain, {
      repo: did,
    })
    if (!res.body.cid) return null
    return parseDnsRecord({
      uri: res.body.uri,
      cid: res.body.cid,
      value: res.body.value,
    })
  } catch (error) {
    if (isRecordNotFound(error)) return null
    throw error
  }
}

/** Find the longest active Marque-owned domain that contains this handle. */
export async function findMarqueDomainForHandle(
  client: Client,
  did: DidString,
  handle: string,
): Promise<MarqueDomainRecord | null> {
  const normalized = handle.toLowerCase().replace(/^@/, '')
  const domains = await listMarqueDomainRecords(client, did)
  const matches = domains.filter(
    domain =>
      domain.status === 'active' &&
      (normalized === domain.domain ||
        normalized.endsWith(`.${domain.domain}`)),
  )
  return matches.sort((a, b) => b.domain.length - a.domain.length)[0] ?? null
}

/** List every valid Marque domain record in the user's repository. */
export async function listMarqueDomainRecords(
  client: Client,
  did: DidString,
): Promise<MarqueDomainRecord[]> {
  let cursor: string | undefined
  const domains: MarqueDomainRecord[] = []
  do {
    const res = await client.listRecords('at.marque.domain', {
      repo: did,
      limit: 100,
      cursor,
    })
    for (const item of res.body.records) {
      const parsed = parseDomainRecord({
        uri: item.uri,
        cid: item.cid,
        value: item.value,
      })
      if (parsed) domains.push(parsed)
    }
    cursor = res.body.cursor
  } while (cursor)
  return domains
}

/**
 * Add the missing AT Protocol TXT record to a Marque-managed DNS zone.
 * Existing records are preserved. A conflicting existing TXT record is left
 * untouched so the client never silently overwrites another DID delegation.
 */
export async function ensureMarqueAtprotoRecord(
  client: Client,
  did: DidString,
  handle: string,
): Promise<'created' | 'exists' | 'conflict' | 'not-owned'> {
  const normalized = handle.toLowerCase().replace(/^@/, '')
  const domain = await findMarqueDomainForHandle(client, did, normalized)
  if (!domain) return 'not-owned'

  const relative =
    normalized === domain.domain
      ? ''
      : normalized.slice(0, -`.${domain.domain}`.length)
  const name = relative ? `_atproto.${relative}` : '_atproto'
  const value = `did=${did}`
  const dns = await getMarqueDnsRecord(client, did, domain.domain)
  const records = dns?.records ?? []
  const existing = records.find(
    record => record.name === name && record.recordType.toUpperCase() === 'TXT',
  )
  if (existing?.value === value) return 'exists'
  if (existing) return 'conflict'

  await putDnsRecord(
    client,
    did,
    domain.domain,
    {
      uri: domain.uri,
      cid: domain.cid,
    },
    [...records, {name, recordType: 'TXT', value, ttl: 300}],
  )
  return 'created'
}

/**
 * `at.marque.partner.listPricing` — list offered TLDs and standard pricing.
 */
export async function listPricing(
  client: Client,
): Promise<{tlds: TldPricing[]}> {
  return client.call(listPricingSchema, {}, proxyToMarque)
}

/**
 * `at.marque.partner.checkAvailability` — check 1-500 candidate domains with
 * live (possibly premium) pricing. Each result is independent; a row-level
 * failure surfaces in that row's `error` field rather than throwing.
 */
export async function checkAvailability(
  client: Client,
  domains: string[],
): Promise<{results: AvailabilityResult[]}> {
  return client.call(checkAvailabilitySchema, {domains}, proxyToMarque)
}

/** Registry-specific fields that must be collected before checkout. */
export async function getRequirements(
  client: Client,
  domains: string[],
): Promise<{results: DomainRequirement[]}> {
  return client.call(getRequirementsSchema, {domains}, proxyToMarque)
}

/**
 * `at.marque.partner.createCheckout` — validate an order and create a hosted
 * payment page. Redirect the user to the returned `checkoutUrl`.
 */
export async function createCheckout(
  client: Client,
  input: {
    items: CheckoutItem[]
    registrant: Registrant
    paymentMethod?: PaymentMethod
    successUrl: string
    cancelUrl: string
  },
): Promise<CheckoutResponse> {
  return client.call(createCheckoutSchema, input, proxyToMarque)
}

/**
 * `at.marque.partner.getOrder` — poll payment and provisioning status. Poll
 * until `provisioned` or `failed`, then inspect each item individually.
 */
export async function getOrder(
  client: Client,
  orderId: string,
): Promise<Order> {
  return client.call(getOrderSchema, {orderId}, proxyToMarque)
}

/**
 * Write the `at.marque.domain` record to the user's repository, keyed by the
 * fully qualified domain. Returns the AT URI and CID needed for the DNS
 * record's strong reference.
 */
export async function putDomainRecord(
  client: Client,
  did: DidString,
  domain: string,
  value: {
    status: string
    registeredAt?: string
    expiresAt?: string
    nameServers?: string[]
    autoRenew?: boolean
  },
): Promise<{uri: string; cid: string}> {
  const now = new Date().toISOString()
  const res = await client.putRecord(
    {
      $type: 'at.marque.domain',
      domain,
      status: value.status,
      registeredAt: value.registeredAt,
      expiresAt: value.expiresAt,
      nameServers: value.nameServers,
      autoRenew: value.autoRenew,
      createdAt: now,
    },
    domain,
    {repo: did, validate: false},
  )
  return {uri: res.body.uri, cid: res.body.cid}
}

/**
 * Write the `at.marque.dns` record, pointing back at the matching
 * `at.marque.domain` record. Only meaningful when the domain uses Marque
 * nameservers.
 */
export async function putDnsRecord(
  client: Client,
  did: DidString,
  domain: string,
  subject: {uri: string; cid: string},
  records: MarqueDnsEntry[] = [],
): Promise<{uri: string; cid: string}> {
  const now = new Date().toISOString()
  const res = await client.putRecord(
    {
      $type: 'at.marque.dns',
      domain,
      subject,
      records,
      createdAt: now,
    },
    domain,
    {repo: did, validate: false},
  )
  return {uri: res.body.uri, cid: res.body.cid}
}
