import {useCallback} from 'react'
import {type UriString} from '@atproto/lex'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {resolveLinkQueryOptions} from '#/state/queries/resolve-link'
import {useAppviewClient, useChatClient} from '#/state/session'
import {type PostAction} from '#/view/com/composer/state/composer'
import * as Toast from '#/components/Toast'
import {fetchIsTrustedTile} from './author'

/**
 * Attaches a tile at-URI to a post draft as its link card, the way the
 * composer attaches a pasted one and the toolbar button a typed one.
 *
 * Anyone may post a tile, but only a tile whose author is one of our verified
 * accounts will play, so one by anyone else is refused here with the reason
 * rather than attached as a card that never works. The resolution is the same
 * cached one the preview uses; if it fails, the tile is attached anyway and
 * the preview shows the error. Resolves to whether the tile was attached.
 */
export function useAttachTile(
  dispatch: (action: PostAction) => void,
): (uri: string) => Promise<boolean> {
  const {t: l} = useLingui()
  const queryClient = useQueryClient()
  const appviewClient = useAppviewClient()
  const chatClient = useChatClient()
  return useCallback(
    async (uri: string) => {
      let tile
      try {
        const resolved = await queryClient.fetchQuery(
          resolveLinkQueryOptions({appviewClient, chatClient}, uri),
        )
        tile = resolved.type === 'external' ? resolved.tile : undefined
      } catch {
        dispatch({type: 'embed_add_uri', uri: uri as UriString})
        return true
      }
      if (
        tile &&
        !(await fetchIsTrustedTile(queryClient, appviewClient, tile))
      ) {
        Toast.show(
          l`Only tiles published by verified accounts can be posted.`,
          {
            type: 'error',
          },
        )
        return false
      }
      dispatch({type: 'embed_add_uri', uri: uri as UriString})
      return true
    },
    [dispatch, queryClient, appviewClient, chatClient, l],
  )
}
