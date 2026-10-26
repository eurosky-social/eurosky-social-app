import {AtUri, type NsidString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {app, com} from '#/lexicons'
import * as bsky from '#/types/bsky'

export type VerificationRecord = {
  /** The subject's handle frozen at the moment of verifying. */
  handle: string
  /** The subject's display name frozen at the moment of verifying. */
  displayName: string
  createdAt: string
}

const verificationRecordQueryKeyRoot = 'verification-record'

/**
 * Fetches the body of an `app.bsky.graph.verification` record from the issuer's
 * repo. The Constellation backlink index only gives us the record's identity,
 * so this is how we recover `createdAt` and the frozen handle/displayName needed
 * to compute strict validity. Only enabled where we actually need the body (the
 * verifications dialog), so we don't pay for it on every badge.
 */
export function useVerificationRecordQuery({
  uri,
  enabled,
}: {
  uri: string
  enabled: boolean
}) {
  const appviewClient = useAppviewClient()
  return useQuery<VerificationRecord>({
    queryKey: createQueryKey(verificationRecordQueryKeyRoot, {uri}),
    enabled: enabled && !!uri,
    staleTime: STALE.MINUTES.FIVE,
    queryFn: async () => {
      const atUri = new AtUri(uri)
      const data = await appviewClient.call(com.atproto.repo.getRecord, {
        repo: atUri.host,
        collection: atUri.collection as NsidString,
        rkey: atUri.rkey,
      })
      if (!bsky.isType(app.bsky.graph.verification, data.value)) {
        throw new Error('Record is not a verification')
      }
      const value = data.value
      return {
        handle: value.handle,
        displayName: value.displayName ?? '',
        createdAt: value.createdAt,
      }
    },
  })
}
