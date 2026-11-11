import {type PostArticle} from '#/features/articles/articles'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {cardHasMedia} from './model'
import {
  buildDiscoverSections,
  buildFollowingSections,
  latestGroups,
} from './sections'

const NOW = new Date(2026, 10, 11, 12, 0, 0)
const HOUR = 3_600_000
const ORDER = [
  'top',
  'popular',
  'video',
  'shorts',
  'publisher',
  'topic',
  'latest',
] as const

let next = 0
function story({
  publisher = 0,
  hoursAgo = 1,
  replies = 0,
  reposts = 0,
  media = 'image',
  tag,
}: {
  publisher?: number
  hoursAgo?: number
  replies?: number
  reposts?: number
  media?: 'image' | 'video' | 'none'
  tag?: string
} = {}): PostArticle {
  const id = next++
  const did = PUBLISHERS[publisher].did
  return {
    item: {
      uri: `at://${did}/app.bsky.feed.post/${id}`,
      record: {
        $type: 'app.bsky.feed.post',
        text: `Story ${id}`,
        createdAt: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString(),
        facets: tag
          ? [
              {
                index: {byteStart: 0, byteEnd: 1},
                features: [{$type: 'app.bsky.richtext.facet#tag', tag}],
              },
            ]
          : [],
      },
      post: {
        uri: `at://${did}/app.bsky.feed.post/${id}`,
        author: {did, handle: PUBLISHERS[publisher].domain},
        replyCount: replies,
        repostCount: reposts,
      },
    },
    title: `Story ${id}`,
    description: '',
    imageAlt: '',
    image: media === 'none' ? undefined : 'https://example.com/a.jpg',
    external:
      media === 'image'
        ? {
            uri: `https://example.com/${id}`,
            title: `Story ${id}`,
            description: '',
            thumb: 'https://example.com/a.jpg',
          }
        : undefined,
    media:
      media === 'video'
        ? {type: 'video', view: {presentation: undefined}}
        : undefined,
  } as unknown as PostArticle
}

/** A realistic 60-story window across five publishers. */
function window60() {
  next = 0
  return Array.from({length: 60}, (_, i) =>
    story({
      publisher: i % 5,
      hoursAgo: 1 + i * 0.4,
      replies: (i * 7) % 11,
      reposts: (i * 3) % 7,
      media: i % 6 === 0 ? 'video' : i % 4 === 0 ? 'none' : 'image',
      tag: i % 3 === 0 ? 'climate' : i % 5 === 1 ? 'ukraine' : 'wired',
    }),
  )
}

function uris(articles: readonly PostArticle[]) {
  return articles.map(article => article.item.uri)
}

it('runs the sections in the agreed order', () => {
  const kinds = buildDiscoverSections(window60(), NOW, {shorts: true}).map(
    section => section.kind,
  )
  expect(kinds).toEqual(
    expect.arrayContaining(['top', 'popular', 'video', 'shorts', 'latest']),
  )
  const positions = kinds.map(kind => ORDER.indexOf(kind))
  expect(positions).toEqual([...positions].sort((x, y) => x - y))
})

it('shows every story exactly once', () => {
  const articles = window60()
  const sections = buildDiscoverSections(articles, NOW, {shorts: true})
  const shown = sections.flatMap(section => uris(section.articles))
  expect(new Set(shown).size).toBe(shown.length)
  expect([...shown].sort()).toEqual(uris(articles).sort())
})

it('leads with a story that has media and caps each publisher at two in Top stories', () => {
  const top = buildDiscoverSections(window60(), NOW, {shorts: false})[0]
  expect(top.kind).toBe('top')
  expect(top.articles).toHaveLength(6)
  expect(cardHasMedia(top.articles[0])).toBe(true)
  const counts = new Map<string, number>()
  for (const article of top.articles) {
    const did = article.item.post.author.did
    counts.set(did, (counts.get(did) ?? 0) + 1)
  }
  expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
})

it('fills publisher sections with three stories from that publisher, at most three sections', () => {
  const sections = buildDiscoverSections(window60(), NOW, {shorts: false})
  const publishers = sections.filter(section => section.kind === 'publisher')
  expect(publishers.length).toBeGreaterThan(0)
  expect(publishers.length).toBeLessThanOrEqual(3)
  for (const section of publishers) {
    expect(section.articles).toHaveLength(3)
    const dids = new Set(section.articles.map(a => a.item.post.author.did))
    expect(dids.size).toBe(1)
    expect(section.publisherId).toBeTruthy()
  }
})

it('never turns a publisher name into a topic, and keeps topics to five', () => {
  const topics = buildDiscoverSections(window60(), NOW, {shorts: false}).filter(
    section => section.kind === 'topic',
  )
  expect(topics.length).toBeGreaterThan(0)
  expect(topics.length).toBeLessThanOrEqual(5)
  expect(topics.map(section => section.tag)).not.toContain('wired')
  for (const section of topics) expect(section.articles).toHaveLength(3)
})

it('falls back to Top stories and Latest on a thin feed', () => {
  next = 0
  const articles = Array.from({length: 19}, (_, i) =>
    story({publisher: i % 4, hoursAgo: i + 1}),
  )
  expect(
    buildDiscoverSections(articles, NOW, {shorts: true}).map(s => s.kind),
  ).toEqual(['top', 'latest'])
})

it('keeps Following personal: Top stories then Latest', () => {
  const sections = buildFollowingSections(window60(), NOW)
  expect(sections.map(section => section.kind)).toEqual(['top', 'latest'])
})

it('relaxes the publisher cap when only one publisher is followed', () => {
  next = 0
  const articles = Array.from({length: 30}, (_, i) =>
    story({publisher: 0, hoursAgo: i + 1}),
  )
  expect(buildFollowingSections(articles, NOW)[0].articles).toHaveLength(6)
})

it('groups Latest by today, yesterday and older dates', () => {
  next = 0
  const today = story({hoursAgo: 2})
  const yesterday = story({hoursAgo: 20})
  const older = story({hoursAgo: 80})
  expect(
    latestGroups([today, yesterday, older], NOW).map(group => group.bucket),
  ).toEqual(['today', 'yesterday', 'date'])
})

it('keeps an already-shown Top stories block when sections are built later', () => {
  const articles = window60()
  const top = articles.slice(10, 16)
  const sections = buildDiscoverSections(articles, NOW, {shorts: true, top})
  expect(sections[0].articles).toEqual(top)
  const elsewhere = sections.slice(1).flatMap(section => uris(section.articles))
  for (const article of top) expect(elsewhere).not.toContain(article.item.uri)
})

it('never repeats a story when Top stories come from an earlier render', () => {
  const articles = window60()
  const shownTop = buildDiscoverSections(articles, NOW, {shorts: false})[0]
    .articles
  const fresh = articles.map(article => structuredClone(article))
  const sections = buildDiscoverSections(fresh, NOW, {
    shorts: false,
    top: shownTop,
  })
  const shown = sections.flatMap(section => uris(section.articles))
  expect(new Set(shown).size).toBe(shown.length)
})

it('keeps the original casing of a topic', () => {
  next = 0
  const articles = Array.from({length: 40}, (_, i) =>
    story({publisher: i % 5, hoursAgo: 1 + i, tag: i % 2 ? 'AI' : undefined}),
  )
  const topic = buildDiscoverSections(articles, NOW, {shorts: false}).find(
    section => section.kind === 'topic',
  )
  expect(topic?.title).toBe('AI')
})

it('keeps Latest in the order given, grouping consecutive days', () => {
  next = 0
  const a = story({hoursAgo: 2})
  const b = story({hoursAgo: 20})
  const c = story({hoursAgo: 1})
  expect(latestGroups([a, b, c], NOW).map(group => group.bucket)).toEqual([
    'today',
    'yesterday',
    'today',
  ])
})

it('never gives the Lead to a social post, even a popular video', () => {
  next = 0
  const viral = story({media: 'video', replies: 99, hoursAgo: 1})
  const rest = Array.from({length: 30}, (_, i) =>
    story({publisher: i % 5, hoursAgo: 2 + i}),
  )
  const top = buildDiscoverSections([viral, ...rest], NOW, {shorts: false})[0]
  expect(top.articles[0]).not.toBe(viral)
  expect(top.articles[0].external?.title).toBeTruthy()
})
