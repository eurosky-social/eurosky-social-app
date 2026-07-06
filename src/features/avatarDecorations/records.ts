import {CONSTELLATION_SERVICE, SLINGSHOT_SERVICE} from '#/lib/constants'

/**
 * Entitlement grant, one record per active subscriber, living in the repo of
 * an allowlisted issuer account (BRAND.decorations.issuerDids). Its existence
 * is the whole signal - the deco service creates it on payment and deletes it
 * on lapse. Discovered via the Constellation backlink index, mirroring
 * src/lib/verification/constellation.ts.
 */
export const GRANT_COLLECTION = 'social.mu.deco.grant'
// The JSON path within a grant record to the link we index on. Records look
// like `{subject: <did>, ...}`, so the link to the subject lives at `subject`.
const GRANT_SUBJECT_SOURCE = `${GRANT_COLLECTION}:subject`

/**
 * Cosmetic choices, a self-record in the subscriber's own PDS, written
 * directly by the app with the user's session. One record holds every slot
 * (avatar frame, name gradient, ...); the single grant gates all of them.
 * Survives a lapsed subscription dormant (no grant = nothing renders) so the
 * choices restore on resubscribe.
 */
export const SETTINGS_COLLECTION = 'social.mu.deco.settings'
export const SETTINGS_RKEY = 'self'

/** Resolved slot ids from a settings record; each maps to its own catalog. */
export type DecorationSettings = {
  /** Avatar frame id (catalog.ts). */
  avatar?: string
  /** Display-name gradient id (nameGradients.ts). */
  name?: string
  /** Add a dark outline/shadow around the gradient name (pops on any bg). */
  nameOutline?: boolean
}

type GetBacklinksResponse = {
  total: number
  records: {did: string; collection: string; rkey: string}[]
  cursor?: string
}

/**
 * Returns the DIDs of every account with a `social.mu.deco.grant` record
 * naming `subjectDid`. Network-wide and unfiltered, like verification
 * backlinks: anyone can write records in this collection, so callers must
 * intersect with the issuer allowlist to decide what counts.
 */
export async function getDecorationGrantIssuers(
  subjectDid: string,
): Promise<Set<string>> {
  const issuers = new Set<string>()
  let cursor: string | undefined

  // Bound pagination; grants from allowlisted issuers are few and land early.
  for (let page = 0; page < 3; page++) {
    const url = new URL(
      `/xrpc/blue.microcosm.links.getBacklinks`,
      CONSTELLATION_SERVICE,
    )
    url.searchParams.set('subject', subjectDid)
    url.searchParams.set('source', GRANT_SUBJECT_SOURCE)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), {
      headers: {accept: 'application/json'},
    })
    if (!res.ok) {
      throw new Error(`Constellation getBacklinks failed: ${res.status}`)
    }
    const json = (await res.json()) as GetBacklinksResponse

    for (const r of json.records ?? []) {
      issuers.add(r.did)
    }

    if (!json.cursor || (json.records ?? []).length === 0) break
    cursor = json.cursor
  }

  return issuers
}

/**
 * Fetches the subject's decoration settings record. Goes through slingshot
 * (microcosm's cached record fetcher) rather than the appview: the appview
 * only serves getRecord for collections it indexes (app.bsky.*), while
 * slingshot resolves any DID to its PDS and edge-caches the record.
 */
export async function getDecorationSettings(
  did: string,
): Promise<DecorationSettings> {
  const url = new URL(`/xrpc/com.atproto.repo.getRecord`, SLINGSHOT_SERVICE)
  url.searchParams.set('repo', did)
  url.searchParams.set('collection', SETTINGS_COLLECTION)
  url.searchParams.set('rkey', SETTINGS_RKEY)

  const res = await fetch(url.toString(), {
    headers: {accept: 'application/json'},
  })
  // RecordNotFound and friends - a granted account that never picked anything.
  if (res.status === 400 || res.status === 404) return {}
  if (!res.ok) {
    throw new Error(`Slingshot getRecord failed: ${res.status}`)
  }
  const json = (await res.json()) as {
    value?: {avatar?: unknown; name?: unknown; nameOutline?: unknown}
  }
  const value = json.value ?? {}
  return {
    avatar: typeof value.avatar === 'string' ? value.avatar : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    nameOutline: value.nameOutline === true,
  }
}
