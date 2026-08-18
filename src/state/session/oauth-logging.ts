import {sha256} from 'js-sha256'

const RAW_DID_RE = /did:[a-z0-9%._:-]+/gi
const URL_ENCODED_DID_RE =
  /did%3a(?:[a-z0-9._:-]|%(?:25|2d|2e|3[0-9a]|4[1-9a-f]|5[0-9a]|5f|6[1-9a-f]|7[0-9a]))+/gi

function redactMatchedDid(did: string): string {
  const fingerprint = sha256.create().update(did).hex().slice(0, 5)
  return `did:[redacted-${fingerprint}]`
}

/**
 * Replace raw or URL-encoded DIDs with stable short fingerprints so logs can
 * distinguish accounts without storing the identifiers themselves.
 */
export function redactDid(text: string): string {
  return text
    .replace(URL_ENCODED_DID_RE, did =>
      redactMatchedDid(decodeURIComponent(did)),
    )
    .replace(RAW_DID_RE, redactMatchedDid)
}

/**
 * The OAuth error code and HTTP status live on an `OAuthResponseError`, which
 * may be the thrown error itself or the `cause` of a `TokenRefreshError`.
 */
function extractOAuthResponseFields(
  error: unknown,
): {error?: string; status?: number; detail?: string} | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current != null; depth++) {
    if (typeof current !== 'object') break
    const value = current as Record<string, unknown>
    const oauthError = typeof value.error === 'string' ? value.error : undefined
    const status = typeof value.status === 'number' ? value.status : undefined
    const detail =
      typeof value.errorDescription === 'string'
        ? value.errorDescription
        : undefined
    if (oauthError != null || status != null || detail != null) {
      return {error: oauthError, status, detail}
    }
    current = value.cause
  }
  return undefined
}

/**
 * Return a diagnostic OAuth error description without raw error objects or
 * DIDs.
 */
export function describeOAuthError(cause: unknown): {
  kind: string
  safeMessage?: string
  oauthError?: string
  status?: number
  detail?: string
} {
  const kind =
    cause instanceof Error
      ? cause.constructor?.name || cause.name
      : typeof cause
  const safeMessage =
    cause instanceof Error && typeof cause.message === 'string'
      ? redactDid(cause.message)
      : typeof cause === 'string'
        ? redactDid(cause)
        : undefined
  const oauth = extractOAuthResponseFields(cause)
  return {
    kind,
    ...(safeMessage ? {safeMessage} : {}),
    ...(oauth?.error ? {oauthError: redactDid(oauth.error)} : {}),
    ...(oauth?.status != null ? {status: oauth.status} : {}),
    ...(oauth?.detail ? {detail: redactDid(oauth.detail)} : {}),
  }
}
