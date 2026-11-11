import {parseEmbedPlayerFromUrl} from '#/lib/strings/embed-player'
import {type PostArticle} from '#/features/articles/articles'
import {type app} from '#/lexicons'

/** What a front-page card shows, derived only from the post's own data. */
export type CardKind =
  | 'article'
  | 'link'
  | 'text'
  | 'image'
  | 'gallery'
  | 'video'
  | 'youtube'
  | 'quote'

export function cardKind(article: PostArticle): CardKind {
  if (article.quote) return 'quote'
  const media = article.media
  if (media?.type === 'video') {
    return media.view.presentation === 'gif' ? 'image' : 'video'
  }
  if (media?.type === 'images') {
    return media.view.images.length > 1 ? 'gallery' : 'image'
  }
  if (media?.type === 'gallery') {
    return media.view.items.length > 1 ? 'gallery' : 'image'
  }
  const external = article.external
  if (external?.title.trim()) {
    const player = parseEmbedPlayerFromUrl(external.uri)
    if (player?.type === 'youtube_video' || player?.type === 'youtube_short')
      return 'youtube'
    return external.thumb ? 'article' : 'link'
  }
  return 'text'
}

/** Only stories with a picture or video may take Lead and Feature slots. */
export function cardHasMedia(article: PostArticle) {
  const kind = cardKind(article)
  if (kind === 'text' || kind === 'link') return false
  return !!article.image || article.media?.type === 'video'
}

/** The first hashtag stands in for a topic until the tagging service exists. */
export function cardTopic(record: {
  facets?: app.bsky.richtext.facet.Main[]
}): string | undefined {
  for (const facet of record.facets ?? []) {
    for (const feature of facet.features) {
      if (
        feature.$type === 'app.bsky.richtext.facet#tag' &&
        'tag' in feature &&
        typeof feature.tag === 'string' &&
        feature.tag
      ) {
        return feature.tag.charAt(0).toUpperCase() + feature.tag.slice(1)
      }
    }
  }
  return undefined
}

export type CardTimeBucket =
  {kind: 'now'} | {kind: 'relative'} | {kind: 'yesterday'} | {kind: 'date'}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Relative under a day, then "Yesterday", then a short date. */
export function cardTimeBucket(created: Date, now: Date): CardTimeBucket {
  const age = now.getTime() - created.getTime()
  if (age < MINUTE) return {kind: 'now'}
  if (age < DAY) return {kind: 'relative'}
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  return created.toDateString() === yesterday.toDateString()
    ? {kind: 'yesterday'}
    : {kind: 'date'}
}

/** Counts live in the card link's name because the count links are skipped by Tab. */
export function cardAccessibleName({
  publisher,
  topic,
  format,
  headline,
  time,
  comments,
  reposts,
  likes,
}: {
  publisher: string
  topic?: string
  format?: string
  headline: string
  time: string
  comments: string
  reposts: string
  likes: string
}) {
  const kicker = [publisher, topic, format].filter(Boolean).join(', ')
  const title = headline.trim()
  const sentence = /[.!?…”"]$/.test(title) ? title : `${title}.`
  return `${kicker}. ${sentence} ${time}. ${comments}, ${reposts}, ${likes}.`
}
