import {useMemo} from 'react'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useMergedThreadgateHiddenReplies} from '#/state/threadgate-hidden-replies'
import {type app} from '#/lexicons'
import {
  momentTitleQuote,
  POSTS_PER_REQUEST,
  sortMomentPosts,
  visibleMomentPosts,
} from './momentPosts'
import {type Moment} from './moments'
import {useMomentPosts} from './useMomentPosts'

/**
 * A moment's title and how many people commented, for a list of moments:
 * from its first `POSTS_PER_REQUEST` comments (one request), the top one
 * quoted. A moment of one comment gets no quote, as on its page. People are
 * counted only when all its comments were read. Nothing is read while
 * `enabled` is false, e.g. for a moment whose comments stay hidden.
 */
export function useMomentTitle({
  moment,
  threadgateRecord,
  enabled,
}: {
  moment: Moment
  threadgateRecord?: app.bsky.feed.threadgate.Main
  enabled: boolean
}): {title: string | undefined; people: number | undefined} {
  const uris = useMemo(
    () =>
      enabled && moment.count > 1
        ? moment.comments.slice(0, POSTS_PER_REQUEST).map(c => c.uri)
        : [],
    [enabled, moment],
  )
  const posts = useMomentPosts(uris)
  const moderationOpts = useModerationOpts()
  const hiddenUris = useMergedThreadgateHiddenReplies({threadgateRecord})
  return useMemo(() => {
    if (!posts.data || !moderationOpts || uris.length === 0) {
      return {title: undefined, people: undefined}
    }
    const visible = visibleMomentPosts(posts.data, hiddenUris, moderationOpts)
    return {
      title: momentTitleQuote(sortMomentPosts(visible, 'top'), moderationOpts),
      people:
        moment.count <= uris.length
          ? new Set(visible.map(p => p.author.did)).size
          : undefined,
    }
  }, [posts.data, moderationOpts, hiddenUris, uris, moment.count])
}
