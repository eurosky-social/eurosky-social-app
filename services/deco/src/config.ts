export type DecoConfig = {
  serviceDid: string
  publicUrl: string
  allowedOrigin: string
  plcDirectoryUrl: string
  devTrustDidHeader: boolean
  mollieApiKey: string
  mollieAmount: string
  mollieCurrency: string
  mollieDescription: string
  billingMonths: number
  checkoutRedirectUrl: string
  issuerPdsUrl: string
  issuerIdentifier: string
  issuerAppPassword: string
  issuerDid: string
  subscriberListUri: string
  sweepSecret: string
  graceDays: number
}

export function env(name: string): string | undefined {
  try {
    if (typeof Deno !== 'undefined' && Deno.env) {
      return Deno.env.get(name) ?? undefined
    }
  } catch {
    // Tests and non-Deno tooling may not grant environment access.
  }
  return (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.[
      name
    ]
}

function required(name: string): string {
  const value = env(name)?.trim()
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function positiveInteger(name: string, fallback: number, max: number): number {
  const raw = env(name)
  const value = raw == null ? fallback : Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`)
  }
  return value
}

function cleanUrl(name: string, fallback?: string): string {
  const raw = (env(name) || fallback || '').trim().replace(/\/+$/, '')
  if (!raw) throw new Error(`Missing required environment variable ${name}`)
  const parsed = new URL(raw)
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error(`${name} must be an https URL`)
  }
  return parsed.toString().replace(/\/+$/, '')
}

export function loadConfig(): DecoConfig {
  const serviceDid = env('SERVICE_DID') || 'did:web:deco.mu.social'
  const publicUrl = cleanUrl('PUBLIC_URL', 'https://deco.mu.social')
  const mollieAmount = env('MOLLIE_AMOUNT') || '3.00'
  if (!/^\d+\.\d{2}$/.test(mollieAmount) || Number(mollieAmount) <= 0) {
    throw new Error('MOLLIE_AMOUNT must be a positive decimal such as 3.00')
  }
  const issuerDid = required('DECO_ISSUER_DID')
  const subscriberListUri = required('DECO_SUBSCRIBER_LIST_URI')
  if (
    !subscriberListUri.startsWith(
      `at://${issuerDid}/app.bsky.graph.list/`,
    )
  ) {
    throw new Error(
      'DECO_SUBSCRIBER_LIST_URI must be an app.bsky.graph.list owned by DECO_ISSUER_DID',
    )
  }

  return {
    serviceDid,
    publicUrl,
    allowedOrigin: env('ALLOWED_ORIGIN') || '*',
    plcDirectoryUrl: env('PLC_DIRECTORY_URL') || 'https://plc.eurosky.network',
    devTrustDidHeader: env('DEV_TRUST_DID_HEADER') === '1',
    mollieApiKey: required('MOLLIE_API_KEY'),
    mollieAmount,
    mollieCurrency: (env('MOLLIE_CURRENCY') || 'EUR').toUpperCase(),
    mollieDescription: env('MOLLIE_DESCRIPTION') || 'Eurosky+ subscription',
    billingMonths: positiveInteger('BILLING_MONTHS', 1, 12),
    checkoutRedirectUrl: cleanUrl(
      'CHECKOUT_REDIRECT_URL',
      'https://mu.social/settings/decorations?checkout=return',
    ),
    issuerPdsUrl: cleanUrl('DECO_ISSUER_PDS_URL'),
    issuerIdentifier: required('DECO_ISSUER_IDENTIFIER'),
    issuerAppPassword: required('DECO_ISSUER_APP_PASSWORD'),
    issuerDid,
    subscriberListUri,
    sweepSecret: required('SWEEP_SECRET'),
    graceDays: positiveInteger('GRACE_DAYS', 5, 30),
  }
}
