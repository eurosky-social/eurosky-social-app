import {type AppBskyActorDefs} from '@atproto/api'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {preferencesQueryKey} from '#/state/queries/preferences'
import {useAgent} from '#/state/session'
import {getPdsAgent} from '#/state/session/pds-agent'

export function usePostInteractionSettingsMutation({
  onError,
  onSettled,
}: {
  onError?: (error: Error) => void
  onSettled?: () => void
} = {}) {
  const qc = useQueryClient()
  const agent = useAgent()
  return useMutation({
    async mutationFn(props: AppBskyActorDefs.PostInteractionSettingsPref) {
      await getPdsAgent(agent).setPostInteractionSettings(props)
    },
    async onSuccess() {
      await qc.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
    onError,
    onSettled,
  })
}
