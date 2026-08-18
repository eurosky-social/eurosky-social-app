import {sha256} from 'js-sha256'

/**
 * Replace DIDs with stable short fingerprints so logs can distinguish accounts
 * without storing the identifiers themselves.
 */
export function redactDid(text: string): string {
  return text.replace(/did:[a-z0-9%._:-]+/gi, did => {
    const fingerprint = sha256.create().update(did).hex().slice(0, 5)
    return `did:[redacted-${fingerprint}]`
  })
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
    ...(oauth?.error ? {oauthError: oauth.error} : {}),
    ...(oauth?.status != null ? {status: oauth.status} : {}),
    ...(oauth?.detail ? {detail: redactDid(oauth.detail)} : {}),
  }
}
