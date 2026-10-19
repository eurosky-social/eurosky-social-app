import {type app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/**
 * Whether a post's embed is a picture or video, the media the image/text
 * layouts move around. Quotes, links and other embeds keep their place.
 */
export function isPostMedia(embed: app.bsky.feed.defs.PostView['embed']) {
  const parsed = bsky.post.parseEmbed(embed)
  return (
    parsed.type === 'images' ||
    parsed.type === 'gallery' ||
    parsed.type === 'video'
  )
}

/** A small preview of a post's picture or video, for the text layout. */
export function getPostMediaThumb(
  embed: app.bsky.feed.defs.PostView['embed'],
): {uri: string; alt: string} | undefined {
  const parsed = bsky.post.parseEmbed(embed)
  switch (parsed.type) {
    case 'images': {
      const image = parsed.view.images[0]
      return image && {uri: image.thumb, alt: image.alt}
    }
    case 'gallery': {
      const image = parsed.view.items.find(item => 'thumbnail' in item)
      return image && 'thumbnail' in image
        ? {uri: image.thumbnail, alt: image.alt ?? ''}
        : undefined
    }
    case 'video':
      return parsed.view.thumbnail
        ? {uri: parsed.view.thumbnail, alt: parsed.view.alt ?? ''}
        : undefined
    default:
      return undefined
  }
}

export type PostLink = {
  uri: string
  title: string
  description: string
  thumb?: string
}

/** A post's link preview, if its embed is one. */
export function getPostLink(
  embed: app.bsky.feed.defs.PostView['embed'],
): PostLink | undefined {
  const parsed = bsky.post.parseEmbed(embed)
  if (parsed.type !== 'link') return undefined
  const {uri, title, description, thumb} = parsed.view.external
  return {uri, title, description, thumb}
}
