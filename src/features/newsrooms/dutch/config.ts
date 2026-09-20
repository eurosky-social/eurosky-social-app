import {type DidString, type NsidString} from '@atproto/syntax'

/**
 * Base URL of the Dutch labeler's consumer API (`/api/*`).
 *
 * Empty disables every Dutch query rather than firing requests that cannot
 * succeed, so the spread falls back to its RSS source with nothing to clean up.
 */
export const DUTCH_API_URL = process.env.EXPO_PUBLIC_DUTCH_API_URL || ''

/**
 * The labeler's service DID, the `aud` of the service-auth token minted for it.
 *
 * Reads are authenticated: the service accepts an atproto service-auth JWT, so
 * the news view is for signed-in users rather than for anyone. Minting needs the
 * audience to be the service's real DID - the labels currently carry
 * `did:web:dutch-labeler.invalid`, a placeholder, so this cannot be guessed
 * from them.
 */
export const DUTCH_API_SERVICE_DID = asDid(
  process.env.EXPO_PUBLIC_DUTCH_API_SERVICE_DID,
)

/**
 * Lexicon method to bind the token to, when the service pins one.
 *
 * `lxm` scopes a service-auth token to a single method, so a token minted for
 * one service cannot be replayed against another. The consumer API is REST
 * rather than XRPC and so has no natural NSID; leave this unset unless the
 * service asks for a specific one.
 */
export const DUTCH_API_LXM = asNsid(process.env.EXPO_PUBLIC_DUTCH_API_LXM)

/**
 * Whether the Dutch source is configured. Both halves are needed: a base URL
 * with no audience mints no token, and the service rejects an anonymous read.
 */
export const IS_DUTCH_API_CONFIGURED =
  DUTCH_API_URL !== '' && DUTCH_API_SERVICE_DID !== undefined

/**
 * A configured value shaped like a DID, or undefined. Minting rejects anything
 * else, so a malformed value is treated as unset rather than carried into the
 * call - the spread then stays on RSS instead of erroring on every fetch.
 */
function asDid(value: string | undefined): DidString | undefined {
  return value && /^did:[a-z]+:.+/.test(value)
    ? (value as DidString)
    : undefined
}

/** A configured value shaped like an NSID, or undefined. */
function asNsid(value: string | undefined): NsidString | undefined {
  return value && /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/i.test(value)
    ? (value as NsidString)
    : undefined
}

/** An API path with its query, against the configured base. */
export function buildDutchApiUrl(
  path: string,
  params: Record<string, string | number | undefined> = {},
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return `${DUTCH_API_URL}${path}${query ? `?${query}` : ''}`
}
