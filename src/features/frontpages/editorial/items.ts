import {type AtUriString} from '@atproto/syntax'
import {moderatePost, type ModerationOpts} from '@bsky/sdk/moderation'

import {type FeedPostSliceItem} from '#/state/queries/post-feed'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {articleFromPost, type EditorialArticle} from './articles'
import {articleModeration} from './moderation'

export type ResourceItem = {
  kind: 'feed' | 'starterPack'
  item: {uri: AtUriString}
  title: string
  url?: undefined
  feed?: app.bsky.feed.defs.GeneratorView
  starterPack?: bsky.starterPack.AnyStarterPackView
}
export type EditorialItem = EditorialArticle | ResourceItem

export function isResourceItem(item: EditorialItem): item is ResourceItem {
  return 'kind' in item
}

/** Preserve the source feed's ordering, thread links and normal moderation for embedded previews. */
export function previewPosts(
  feed: app.bsky.feed.defs.FeedViewPost[],
  opts: ModerationOpts,
) {
  const seen = new Set<string>()
  return feed
    .flatMap(view => {
      if (
        seen.has(view.post.uri) ||
        !bsky.matches(app.bsky.feed.post, view.post.record)
      )
        return []
      seen.add(view.post.uri)
      const moderation = moderatePost(view.post, opts)
      if (moderation.ui('contentList').filter) return []
      return [
        {
          post: view.post,
          record: view.post.record,
          moderation,
          reason: view.reason,
          feedContext: view.feedContext,
        },
      ]
    })
    .slice(0, 2)
}

export function feedItem(feed: app.bsky.feed.defs.GeneratorView): ResourceItem {
  return {kind: 'feed', item: {uri: feed.uri}, title: feed.displayName, feed}
}

export function starterPackItem(
  pack: bsky.starterPack.AnyStarterPackView,
): ResourceItem | undefined {
  if (!bsky.matches(app.bsky.graph.starterpack, pack.record)) return
  return {
    kind: 'starterPack',
    item: {uri: pack.uri},
    title: pack.record.name,
    starterPack: pack,
  }
}

/** The picker has a separate feed cache so browsing older posts never adds them to the preview. */
export function pickerArticles(
  feed: app.bsky.feed.defs.FeedViewPost[],
  did: string,
  opts: ModerationOpts,
) {
  const seen = new Set<string>()
  return feed.flatMap(view => {
    const {post} = view
    if (
      view.reason?.$type === 'app.bsky.feed.defs#reasonRepost' ||
      post.author.did !== did ||
      !bsky.matches(app.bsky.feed.post, post.record) ||
      post.record.reply ||
      seen.has(post.uri)
    )
      return []
    seen.add(post.uri)
    const item: FeedPostSliceItem = {
      _reactKey: post.uri,
      uri: post.uri,
      post,
      record: post.record,
      moderation: moderatePost(post, opts),
    }
    const article = articleFromPost(item)
    return articleModeration(article, opts).filter ? [] : [article]
  })
}
