import {AtUri} from '@atproto/syntax'

import {AuthorFeedAPI} from '#/lib/api/feed/author'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {findPublisherByDid} from './publishers'

/** Check the thread root, not the immediate parent: nested reader replies also count. */
export function isPublisherReply(
  item: app.bsky.feed.defs.FeedViewPost,
  actor: string,
) {
  if (
    item.reason ||
    item.post.author.did !== actor ||
    !bsky.isType(app.bsky.feed.post.main, item.post.record)
  )
    return false
  const root = item.post.record.reply?.root.uri
  if (!root) return false
  try {
    const uri = new AtUri(root)
    return (
      uri.collection === 'app.bsky.feed.post' && !!findPublisherByDid(uri.host)
    )
  } catch {
    return false
  }
}

/** Separate cache descriptor so filtering a news profile cannot contaminate social feeds. */
export class PublisherRepliesAPI extends AuthorFeedAPI {
  _filter(feed: app.bsky.feed.defs.FeedViewPost[]) {
    return feed.filter(item => isPublisherReply(item, this.params.actor))
  }
}
