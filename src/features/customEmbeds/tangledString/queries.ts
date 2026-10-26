import {type AtIdentifierString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {createServiceClient} from '#/lib/lexClient'
import {STALE} from '#/state/queries'
import {useAppviewClient} from '#/state/session'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {app, com} from '#/lexicons'
import {STRING_COLLECTION, type TangledStringValue} from './lexicon'

export type TangledStringData = {
  did: string
  value: TangledStringValue
  /** Owner profile, best-effort (the card still renders without it). */
  author?: app.bsky.actor.defs.ProfileViewDetailed
}

/**
 * Reads a `sh.tangled.string` record directly from the owner's repo. The code
 * is inline in the record, so this single read is all the card needs.
 *
 * A PDS only serves `com.atproto.repo.getRecord` for repos it hosts, and the
 * snippet rarely lives on the viewer's PDS, so we resolve the owner's DID +
 * PDS and read from an unauthenticated client pointed at that PDS. The author
 * profile comes from the viewer's appview client for the byline and is allowed
 * to fail without blocking the snippet.
 */
export function useTangledStringQuery({
  actor,
  rkey,
  enabled = true,
}: {
  actor: string
  rkey: string
  enabled?: boolean
}) {
  const appviewClient = useAppviewClient()
  return useQuery<TangledStringData>({
    queryKey: ['tangledString', actor, rkey],
    enabled: enabled && !!actor && !!rkey,
    queryFn: async () => {
      const {did, pds} = await resolveDidAndPds(actor)
      const pdsClient = createServiceClient(pds)
      const [record, author] = await Promise.all([
        pdsClient.call(com.atproto.repo.getRecord, {
          repo: did as AtIdentifierString,
          collection: STRING_COLLECTION,
          rkey,
        }),
        appviewClient
          .call(app.bsky.actor.getProfile, {
            actor: did as AtIdentifierString,
          })
          .catch(() => undefined),
      ])
      return {
        did,
        value: record.value,
        author,
      }
    },
    staleTime: STALE.MINUTES.FIVE,
  })
}
