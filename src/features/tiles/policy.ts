import {type AtIdentifierString, AtUri} from '@atproto/syntax'
import {type QueryClient, queryOptions, useQuery} from '@tanstack/react-query'

import {TRUSTED_VERIFIER_LIST_URIS} from '#/lib/constants'
import {createServiceClient} from '#/lib/lexClient'
import {isRecordNotFoundError} from '#/lib/xrpc-error'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {com} from '#/lexicons'

/**
 * The switch that pauses every tile at once: a `social.mu.tiles.policy`
 * record (lexicons/social/mu/tiles/policy.json) in the brand's admin repo,
 * the account that owns its trusted-verifier list, so the people who decide
 * whose tiles run also decide whether any do. Every client reads it when a
 * tile is about to play and keeps rereading it while one runs, so flipping
 * it (services/tiles/policy.mjs) reaches open apps within a minute, with no
 * release. No record, or one that cannot be read, means tiles play: the
 * switch can stop tiles, the admin PDS being down cannot.
 */
export const TILES_POLICY_COLLECTION = 'social.mu.tiles.policy'

/** The repo the policy lives in: the creator of the first trusted-verifier list. */
export const TILES_POLICY_REPO: string | undefined =
  TRUSTED_VERIFIER_LIST_URIS[0]
    ? new AtUri(TRUSTED_VERIFIER_LIST_URIS[0]).host
    : undefined

export type TilesPolicy = {
  enabled: boolean
  /** Shown on the cards while paused. */
  message?: string
}

export const TILES_ON: TilesPolicy = {enabled: true}

/** The policy a record holds; anything malformed reads as "tiles play". */
export function parseTilesPolicy(value: unknown): TilesPolicy {
  if (!value || typeof value !== 'object') return TILES_ON
  const {enabled, message} = value as {enabled?: unknown; message?: unknown}
  if (typeof enabled !== 'boolean') return TILES_ON
  const text = typeof message === 'string' ? message.trim() : ''
  return text ? {enabled, message: text} : {enabled}
}

async function fetchTilesPolicy(): Promise<TilesPolicy> {
  if (!TILES_POLICY_REPO) return TILES_ON
  const {did, pds} = await resolveDidAndPds(TILES_POLICY_REPO)
  const client = createServiceClient(pds)
  try {
    const record = await client.call(com.atproto.repo.getRecord, {
      repo: did as AtIdentifierString,
      collection: TILES_POLICY_COLLECTION,
      rkey: 'self',
    })
    return parseTilesPolicy(record.value)
  } catch (e) {
    if (isRecordNotFoundError(e)) return TILES_ON
    throw e
  }
}

export function tilesPolicyQueryOptions() {
  return queryOptions<TilesPolicy>({
    queryKey: createQueryKey('tiles-policy', {repo: TILES_POLICY_REPO ?? ''}),
    queryFn: fetchTilesPolicy,
    staleTime: STALE.SECONDS.THIRTY,
    refetchInterval: STALE.MINUTES.ONE,
    refetchOnWindowFocus: true,
  })
}

/** The current policy for a render; "tiles play" until known. */
export function useTilesPolicy(): TilesPolicy {
  const {data} = useQuery(tilesPolicyQueryOptions())
  return data ?? TILES_ON
}

/**
 * Whether tiles are paused, for code outside a render: the gate the embeds
 * apply before loading anything and the composer before attaching. The
 * policy when paused, false otherwise, including when it cannot be read.
 */
export async function fetchTilesPaused(
  queryClient: QueryClient,
): Promise<TilesPolicy | false> {
  try {
    const policy = await queryClient.fetchQuery(tilesPolicyQueryOptions())
    return policy.enabled ? false : policy
  } catch {
    return false
  }
}

/** Thrown by the post pipeline when a tile is attached while tiles are paused. */
export class TilesPausedError extends Error {
  constructor() {
    super('Tiles are paused')
  }
}
