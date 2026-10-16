import {moderatePost, type ModerationDecision} from '@bsky/sdk/moderation'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {PostFeedItem} from '#/view/com/posts/PostFeedItem'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {useArticleThreadRepliesQueries} from '../queries'

/** One row of the article's discussion: a post, or one of its replies. */
export type ArticleThreadItem = {
  key: string
  post: app.bsky.feed.defs.PostView
  record: app.bsky.feed.post.Main
  moderation: ModerationDecision
  /** The post a reply answers; the thread it belongs to. */
  rootPost: app.bsky.feed.defs.PostView
  parentAuthor?: app.bsky.actor.defs.ProfileViewBasic
  isThreadParent: boolean
  isThreadChild: boolean
  isThreadLastChild: boolean
}

/**
 * An article's discussion as feed slices: each post that shared it, and under
 * it up to three replies, drawn with the feed's own thread lines so it reads
 * like any feed.
 *
 * The publisher's own post leads, as the story's canonical thread; the rest
 * run newest first.
 */
export function useArticleThreadItems({
  posts,
  anchorUri,
}: {
  posts: app.bsky.feed.defs.PostView[]
  /** The publisher's own post of the article, when there is one. */
  anchorUri?: string
}): ArticleThreadItem[] {
  const moderationOpts = useModerationOpts()
  const ordered = [
    ...posts.filter(post => post.uri === anchorUri),
    ...posts
      .filter(post => post.uri !== anchorUri)
      .sort((x, y) => y.indexedAt.localeCompare(x.indexedAt)),
  ]
  const replies = useArticleThreadRepliesQueries({
    uris: ordered.map(post => post.uri),
  })

  /* Search results do not apply the app's moderation preferences for us. */
  if (!moderationOpts) return []

  const items: ArticleThreadItem[] = []
  ordered.forEach((root, index) => {
    const slice = [root, ...(replies[index]?.data ?? [])]
      .map(post => ({post, moderation: moderatePost(post, moderationOpts)}))
      .filter(({moderation}) => !moderation.ui('contentList').filter)
    /* A reply without the post it answers would read as a stray post. */
    if (slice[0]?.post.uri !== root.uri) return

    slice.forEach(({post, moderation}, position) => {
      if (!bsky.isType(app.bsky.feed.post, post.record)) return
      const isLast = position === slice.length - 1
      items.push({
        key: `${root.uri}:${post.uri}`,
        post: withoutLinkCard(post),
        record: post.record,
        moderation,
        rootPost: root,
        parentAuthor: position > 0 ? root.author : undefined,
        isThreadParent: !isLast,
        isThreadChild: position > 0,
        isThreadLastChild: position > 0 && isLast,
      })
    })
  })
  return items
}

/** A discussion row, as the feed renders a post. */
export function ArticleThreadPost({item}: {item: ArticleThreadItem}) {
  return (
    <PostFeedItem
      post={item.post}
      record={item.record}
      reason={undefined}
      feedContext={undefined}
      reqId={undefined}
      moderation={item.moderation}
      parentAuthor={item.parentAuthor}
      showReplyTo={false}
      isThreadParent={item.isThreadParent}
      isThreadChild={item.isThreadChild}
      isThreadLastChild={item.isThreadLastChild}
      rootPost={item.rootPost}
    />
  )
}

/**
 * The post without its link card. Every post here links the article the page
 * is already about, so the card would repeat the header on every row; images
 * and quoted posts are the post's own and stay.
 */
function withoutLinkCard(
  post: app.bsky.feed.defs.PostView,
): app.bsky.feed.defs.PostView {
  return bsky.isType(app.bsky.embed.external.view, post.embed)
    ? {...post, embed: undefined}
    : post
}
