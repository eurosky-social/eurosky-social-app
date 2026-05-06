import {useCallback} from 'react'
import {type ChatBskyConvoDefs} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {useConvoActive} from '#/state/messages/convo'
import {useSession} from '#/state/session'
import * as Toast from '#/components/Toast'
import {hasReachedReactionLimit} from './util'

/**
 * Returns a stable callback that toggles a reaction on the given message: if
 * the current account has already reacted with this emoji, it removes it;
 * otherwise it adds it (subject to the per-user limit). Surfaces failures via
 * a toast.
 */
export function useToggleMessageReaction(
  message: ChatBskyConvoDefs.MessageView,
) {
  const {t: l} = useLingui()
  const convo = useConvoActive()
  const {currentAccount} = useSession()

  return useCallback(
    (emoji: string) => {
      const alreadyReacted = message.reactions?.some(
        reaction =>
          reaction.value === emoji &&
          reaction.sender.did === currentAccount?.did,
      )
      if (alreadyReacted) {
        convo.removeReaction(message.id, emoji).catch(() =>
          Toast.show(l`Failed to remove emoji reaction`, {
            type: 'error',
          }),
        )
      } else {
        if (hasReachedReactionLimit(message, currentAccount?.did)) return
        convo.addReaction(message.id, emoji).catch(() =>
          Toast.show(l`Failed to add emoji reaction`, {
            type: 'error',
          }),
        )
      }
    },
    [l, convo, message, currentAccount?.did],
  )
}
