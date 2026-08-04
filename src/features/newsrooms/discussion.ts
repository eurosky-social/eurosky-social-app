import {type AppBskyFeedDefs} from '@atproto/api'

import {postUriToRelativePath} from '#/lib/strings/url-helpers'

/**
 * Where an article's in-network posts live. The publisher's own post is the
 * article's canonical thread, so it wins; without one, a URL search is the only
 * view that gathers every post about the article.
 */
export function articleDiscussionPath({
  url,
  anchor,
}: {
  url: string
  anchor?: AppBskyFeedDefs.PostView | null
}): {path: string; isAnchor: boolean} {
  const anchorPath = anchor
    ? postUriToRelativePath(anchor.uri, {handle: anchor.author.handle})
    : undefined
  return anchorPath
    ? {path: anchorPath, isAnchor: true}
    : {path: `/search?q=${encodeURIComponent(url)}`, isAnchor: false}
}
