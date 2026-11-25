import {type AtUriString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {useAppviewClient} from '#/state/session'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {commentRepliesQueryKey} from './queryKeys'

/**
 * The direct replies to a comment, from the viewer's AppView: one thread
 * fetch, one level deep, while the comment is on screen.
 */
export function useCommentReplies(uri: string, enabled: boolean) {
  const client = useAppviewClient()
  return useQuery({
    queryKey: commentRepliesQueryKey(uri),
    enabled,
    staleTime: STALE.MINUTES.ONE,
    async queryFn() {
      const data = await client.call(app.bsky.feed.getPostThread, {
        uri: uri as AtUriString,
        depth: 1,
        parentHeight: 0,
      })
      const thread = data.thread
      if (!bsky.isType(app.bsky.feed.defs.threadViewPost, thread)) return []
      return (thread.replies ?? [])
        .filter(reply => bsky.isType(app.bsky.feed.defs.threadViewPost, reply))
        .map(reply => (reply as app.bsky.feed.defs.ThreadViewPost).post)
    },
  })
}
