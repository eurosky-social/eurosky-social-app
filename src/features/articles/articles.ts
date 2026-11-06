import {type $Typed} from '@atproto/lex'

import {
  type FeedPostSlice,
  type FeedPostSliceItem,
} from '#/state/queries/post-feed'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type EmbedType, parseEmbed} from '#/types/bsky/post'
import {articleLinkKey} from './articleLinks'

/** Shared presentation sizes, independent of any editor or saved layout. */
export type ArticleSize = 'small' | 'medium' | 'big'

export type PostArticle = {
  item: FeedPostSliceItem
  title: string
  description: string
  image?: string
  imageAlt: string
  url?: string
  external?: app.bsky.embed.external.ViewExternal
  media?: EmbedType<'images' | 'gallery' | 'video'>
  quote?: $Typed<app.bsky.embed.record.View>
}

/** Compatibility name for the original editorial renderer. */
export type EditorialArticle = PostArticle

/** Use the post's real link metadata, not a second RSS or aggregator feed. */
export function articleFromPost(item: FeedPostSliceItem): PostArticle {
  const parsed = parseEmbed(item.post.embed)
  const embed = parsed.type === 'post_with_media' ? parsed.media : parsed
  const external = embed.type === 'link' ? embed.view.external : undefined
  const media =
    embed.type === 'images' ||
    embed.type === 'gallery' ||
    embed.type === 'video'
      ? embed
      : undefined
  const image =
    embed.type === 'images'
      ? embed.view.images[0]
      : embed.type === 'gallery'
        ? embed.view.items.find(item =>
            bsky.isType(app.bsky.embed.gallery.viewImage, item),
          )
        : undefined
  const [firstLine, ...rest] = item.record.text.trim().split('\n')
  return {
    item,
    title:
      external?.title.trim() ||
      firstLine ||
      item.post.author.displayName ||
      item.post.author.handle,
    description: external?.description.trim() || rest.join('\n').trim(),
    image:
      external?.thumb ||
      image?.fullsize ||
      (embed.type === 'video' ? embed.view.thumbnail : undefined),
    imageAlt:
      image?.alt ||
      (embed.type === 'video' ? embed.view.alt : undefined) ||
      external?.title ||
      firstLine,
    url: external?.uri,
    external,
    media,
    quote: bsky.isType(app.bsky.embed.recordWithMedia.view, item.post.embed)
      ? {...item.post.embed.record, $type: 'app.bsky.embed.record#view'}
      : bsky.isType(app.bsky.embed.record.view, item.post.embed)
        ? item.post.embed
        : undefined,
  }
}

/** Replies and reposts stay in the standard profile; each article appears once. */
export function articlesFromAuthorFeed(slices: FeedPostSlice[], did: string) {
  const seen = new Set<string>()
  const articles: PostArticle[] = []
  for (const slice of slices) {
    if (slice.reason?.$type === 'app.bsky.feed.defs#reasonRepost') continue
    for (const item of slice.items) {
      if (item.post.author.did !== did || item.record.reply) continue
      const article = articleFromPost(item)
      const key = article.url ? articleLinkKey(article.url) : item.post.uri
      if (seen.has(key)) continue
      seen.add(key)
      articles.push(article)
    }
  }
  return articles
}

/** Compatibility for existing frontpage callers. */
export const editorialArticles = articlesFromAuthorFeed
