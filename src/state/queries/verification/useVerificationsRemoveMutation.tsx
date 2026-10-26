import {AtUri} from '@atproto/syntax'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {
  createMuVerificationQueryKey,
  type MuVerification,
} from '#/state/queries/verification/useMuVerificationQuery'
import {usePdsClient, useSession} from '#/state/session'
import {useAnalytics} from '#/analytics'
import {app} from '#/lexicons'
import type * as bsky from '#/types/bsky'

// See useVerificationCreateMutation: optimistic update + delayed reconcile to
// cover Constellation's firehose indexing lag.
const CONSTELLATION_INDEX_DELAY = 8e3

export function useVerificationsRemoveMutation() {
  const ax = useAnalytics()
  const pdsClient = usePdsClient()
  const qc = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation({
    async mutationFn({
      verifications,
    }: {
      profile: bsky.profile.AnyProfileView
      verifications: app.bsky.actor.defs.VerificationView[]
    }) {
      if (!currentAccount) {
        throw new Error('User not logged in')
      }

      const uris = verifications.map(v => v.uri)

      await Promise.all(
        uris.map(uri => {
          return pdsClient.delete(app.bsky.graph.verification, {
            rkey: new AtUri(uri).rkeySafe,
          })
        }),
      )

      return {uris}
    },
    onSuccess({uris}, {profile}) {
      ax.metric('verification:revoke', {})

      const key = createMuVerificationQueryKey(profile.did)
      qc.setQueryData<MuVerification>(key, prev => {
        if (!prev) return prev
        return {
          ...prev,
          verifications: prev.verifications.filter(v => !uris.includes(v.uri)),
        }
      })
      setTimeout(() => {
        void qc.invalidateQueries({queryKey: key})
      }, CONSTELLATION_INDEX_DELAY)
    },
  })
}
