import {type PostArticle} from '#/features/articles/articles'
import {findPublisherByDid, PUBLISHERS} from '#/features/publishers/publishers'
import {cardHasMedia, cardKind, cardTopic} from './model'
import {rankStories, storyScore} from './ranking'

export type SectionKind =
  'top' | 'popular' | 'video' | 'shorts' | 'publisher' | 'topic' | 'latest'

export type FrontSection = {
  id: string
  kind: SectionKind
  /** Publisher name for `publisher`, title-cased tag for `topic`. */
  title?: string
  publisherId?: string
  tag?: string
  articles: PostArticle[]
}

/** Sections are built from this many loaded stories; the rest flow into Latest. */
export const SECTION_WINDOW = 60
/** Below this, the page shows only Top stories and Latest. */
const THIN_FEED = 20
const TOP_SIZE = 6
const TOP_PER_PUBLISHER = 2
const TWO_ROW_SIZE = 5
const ONE_ROW_SIZE = 3
const MAX_PUBLISHER_SECTIONS = 3
const MAX_TOPIC_SECTIONS = 5

function did(article: PostArticle) {
  return article.item.post.author.did
}
function postedAt(article: PostArticle) {
  return new Date(article.item.record.createdAt).getTime()
}
function newestFirst(articles: readonly PostArticle[]) {
  return [...articles].sort((x, y) => postedAt(y) - postedAt(x))
}

/** Hashtags that only repeat a publisher's name are not topics. */
const PUBLISHER_TAGS = new Set(
  PUBLISHERS.flatMap(publisher => [
    publisher.id.toLowerCase(),
    publisher.id.replace(/-/g, '').toLowerCase(),
    publisher.name.replace(/\s+/g, '').toLowerCase(),
  ]),
)

/**
 * Lead is the best-ranked story with media; the rest follow by rank with at
 * most two per publisher, relaxed when too few publishers can fill the block.
 */
function topStories(ranked: readonly PostArticle[]) {
  const lead = ranked.find(cardHasMedia) ?? ranked[0]
  if (!lead) return []
  const picked = [lead]
  const counts = new Map([[did(lead), 1]])
  for (const article of ranked) {
    if (picked.length >= TOP_SIZE) break
    if (article === lead) continue
    const count = counts.get(did(article)) ?? 0
    if (count >= TOP_PER_PUBLISHER) continue
    picked.push(article)
    counts.set(did(article), count + 1)
  }
  for (const article of ranked) {
    if (picked.length >= TOP_SIZE) break
    if (!picked.includes(article)) picked.push(article)
  }
  return picked
}

/** Discover: recommendations, each story shown once in page order. */
export function buildDiscoverSections(
  articles: readonly PostArticle[],
  now: Date,
  {
    shorts,
    top: shownTop,
  }: {
    shorts: boolean
    /** Top stories already on screen; kept as they are. */
    top?: readonly PostArticle[]
  },
): FrontSection[] {
  const window = articles.slice(0, SECTION_WINDOW)
  /* By URI: the feed rebuilds story objects on every render. */
  const used = new Set<string>()
  const unused = (list: readonly PostArticle[]) =>
    list.filter(article => !used.has(article.item.uri))
  const claim = (list: PostArticle[]) => {
    for (const article of list) used.add(article.item.uri)
    return list
  }
  const ranked = rankStories(window, now)
  const sections: FrontSection[] = []

  const top = claim(shownTop ? [...shownTop] : topStories(ranked))
  if (top.length) sections.push({id: 'top', kind: 'top', articles: top})

  if (window.length >= THIN_FEED) {
    const popular = claim(unused(ranked).slice(0, TWO_ROW_SIZE))
    if (popular.length)
      sections.push({id: 'popular', kind: 'popular', articles: popular})

    const videos = newestFirst(unused(window)).filter(article => {
      const kind = cardKind(article)
      return kind === 'video' || kind === 'youtube'
    })
    if (videos.length >= ONE_ROW_SIZE)
      sections.push({
        id: 'video',
        kind: 'video',
        articles: claim(videos.slice(0, TWO_ROW_SIZE)),
      })

    if (shorts) sections.push({id: 'shorts', kind: 'shorts', articles: []})

    const byPublisher = new Map<string, PostArticle[]>()
    for (const article of unused(window)) {
      const list = byPublisher.get(did(article)) ?? []
      list.push(article)
      byPublisher.set(did(article), list)
    }
    const total = (list: PostArticle[]) =>
      list.reduce((sum, article) => sum + storyScore(article, now), 0)
    const publisherGroups = [...byPublisher.entries()]
      .filter(([, list]) => list.length >= ONE_ROW_SIZE)
      .sort(([, x], [, y]) => total(y) - total(x) || y.length - x.length)
      .slice(0, MAX_PUBLISHER_SECTIONS)
    for (const [publisherDid, list] of publisherGroups) {
      const publisher = findPublisherByDid(publisherDid)
      sections.push({
        id: `publisher-${publisherDid}`,
        kind: 'publisher',
        title: publisher?.name,
        publisherId: publisher?.id,
        articles: claim(newestFirst(list).slice(0, ONE_ROW_SIZE)),
      })
    }

    const tagCounts = new Map<string, number>()
    for (const article of unused(window)) {
      const topic = cardTopic(article.item.record)?.toLowerCase()
      if (!topic || PUBLISHER_TAGS.has(topic)) continue
      tagCounts.set(topic, (tagCounts.get(topic) ?? 0) + 1)
    }
    const tags = [...tagCounts.entries()]
      .filter(([, count]) => count >= ONE_ROW_SIZE)
      .sort(([, x], [, y]) => y - x)
      .map(([tag]) => tag)
    let topics = 0
    for (const tag of tags) {
      if (topics >= MAX_TOPIC_SECTIONS) break
      const list = newestFirst(unused(window)).filter(
        article => cardTopic(article.item.record)?.toLowerCase() === tag,
      )
      if (list.length < ONE_ROW_SIZE) continue
      sections.push({
        id: `topic-${tag}`,
        kind: 'topic',
        /* Keep the publisher's casing (#AI stays AI). */
        title: cardTopic(list[0].item.record) ?? tag,
        tag,
        articles: claim(list.slice(0, ONE_ROW_SIZE)),
      })
      topics++
    }
  }

  sections.push({
    id: 'latest',
    kind: 'latest',
    articles: newestFirst(unused(articles)),
  })
  return sections
}

/** Following: personal, never recommendations. Top stories then Latest. */
export function buildFollowingSections(
  articles: readonly PostArticle[],
  now: Date,
): FrontSection[] {
  const top = topStories(rankStories(articles.slice(0, SECTION_WINDOW), now))
  const shown = new Set(top)
  const sections: FrontSection[] = []
  if (top.length) sections.push({id: 'top', kind: 'top', articles: top})
  sections.push({
    id: 'latest',
    kind: 'latest',
    articles: newestFirst(articles.filter(article => !shown.has(article))),
  })
  return sections
}

export type LatestGroup = {
  bucket: 'today' | 'yesterday' | 'date'
  date: Date
  articles: PostArticle[]
}

/**
 * Group consecutive stories by local calendar day, in the order given. Latest
 * appends each loaded batch, so a day can appear again further down.
 */
export function latestGroups(
  articles: readonly PostArticle[],
  now: Date,
): LatestGroup[] {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const groups: LatestGroup[] = []
  for (const article of articles) {
    const date = new Date(article.item.record.createdAt)
    const day = date.toDateString()
    const bucket =
      day === now.toDateString()
        ? 'today'
        : day === yesterday.toDateString()
          ? 'yesterday'
          : 'date'
    const last = groups.at(-1)
    if (last && last.date.toDateString() === day) last.articles.push(article)
    else groups.push({bucket, date, articles: [article]})
  }
  return groups
}
