import {type AtUriString} from '@atproto/syntax'
import {moderatePost, type ModerationOpts} from '@bsky/sdk/moderation'
import {RichText} from '@bsky/sdk/richtext'

import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {withoutMediaTimeLink} from './record'

type PostView = app.bsky.feed.defs.PostView

/** How a moment's comments are ordered on its page. */
export type MomentSort = 'top' | 'newest'

/** `app.bsky.feed.getPosts` takes at most this many URIs. */
export const POSTS_PER_REQUEST = 25
/**
 * A comment just posted can take a few seconds to reach the AppView, so
 * posts it doesn't return yet are asked for again, a few times.
 */
export const MISSING_POSTS_RETRY_MS = 3_000
export const MISSING_POSTS_RETRIES = 5

/** The posts at `uris`, asked for `POSTS_PER_REQUEST` at a time. */
export async function fetchMomentPosts(
  uris: readonly string[],
  getPosts: (uris: AtUriString[]) => Promise<PostView[]>,
): Promise<PostView[]> {
  const chunks: AtUriString[][] = []
  for (let i = 0; i < uris.length; i += POSTS_PER_REQUEST) {
    chunks.push(uris.slice(i, i + POSTS_PER_REQUEST) as AtUriString[])
  }
  const results = await Promise.all(chunks.map(getPosts))
  return results.flat()
}

/**
 * When to ask again for posts the AppView did not return, or `false`.
 * `fetches` counts the answers so far.
 */
export function missingPostsRetryInterval(
  posts: readonly PostView[] | undefined,
  uris: readonly string[],
  fetches: number,
): number | false {
  if (!posts || fetches > MISSING_POSTS_RETRIES) return false
  const found = new Set<string>(posts.map(p => p.uri))
  return uris.some(uri => !found.has(uri)) ? MISSING_POSTS_RETRY_MS : false
}

/**
 * Most liked first (then most replied to, then oldest), or newest first.
 */
export function sortMomentPosts(
  posts: readonly PostView[],
  sort: MomentSort,
): PostView[] {
  const sorted = [...posts]
  if (sort === 'newest') {
    sorted.sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
  } else {
    sorted.sort(
      (a, b) =>
        (b.likeCount ?? 0) - (a.likeCount ?? 0) ||
        (b.replyCount ?? 0) - (a.replyCount ?? 0) ||
        a.indexedAt.localeCompare(b.indexedAt),
    )
  }
  return sorted
}

/**
 * The posts a moment's page may show: not hidden by the video's author, and
 * not filtered out by the viewer's moderation settings (muted or blocked
 * accounts, muted words, hidden labels). Posts with a warning stay; they
 * show behind it.
 */
export function visibleMomentPosts(
  posts: readonly PostView[],
  hiddenUris: ReadonlySet<string>,
  moderationOpts: ModerationOpts,
): PostView[] {
  return posts.filter(
    post =>
      !hiddenUris.has(post.uri) &&
      !moderatePost(post, moderationOpts).ui('contentList').filter,
  )
}

/** Replies shown under a comment on a moment's page. */
export const SHOWN_REPLIES = 2

/**
 * The replies to show under a comment: the video's author's first (they
 * host the conversation), then the most liked, then the oldest.
 */
export function pickCommentReplies(
  replies: readonly PostView[],
  hostDid: string,
  limit = SHOWN_REPLIES,
): PostView[] {
  return [...replies]
    .sort(
      (a, b) =>
        Number(b.author.did === hostDid) - Number(a.author.did === hostDid) ||
        (b.likeCount ?? 0) - (a.likeCount ?? 0) ||
        a.indexedAt.localeCompare(b.indexedAt),
    )
    .slice(0, limit)
}

/** A comment quoted as a moment's title is cut after this many characters. */
export const TITLE_MAX_CHARS = 120

/**
 * A moment's title until moments get names: the text of its most liked
 * comment that shows without a warning or filter (by a muted account, say),
 * without its time link, cut to `TITLE_MAX_CHARS`. `postsByLikes` is sorted
 * most liked first.
 */
export function momentTitleQuote(
  postsByLikes: readonly PostView[],
  moderationOpts: ModerationOpts,
): string | undefined {
  for (const post of postsByLikes) {
    if (!bsky.matches(app.bsky.feed.post, post.record)) continue
    // A title shows in lists as well as on the moment's page: skip a comment
    // either one would hide or warn about.
    const moderation = moderatePost(post, moderationOpts)
    const inList = moderation.ui('contentList')
    const onPage = moderation.ui('contentView')
    if (inList.filter || inList.blur || inList.alert) continue
    if (onPage.blur || onPage.alert) continue
    const text = withoutMediaTimeLink(
      new RichText({text: post.record.text, facets: post.record.facets}),
    )
      .text.replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    return text.length > TITLE_MAX_CHARS
      ? `${text.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`
      : text
  }
  return undefined
}
