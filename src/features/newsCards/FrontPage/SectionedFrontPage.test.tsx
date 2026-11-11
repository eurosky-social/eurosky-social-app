import {Text} from 'react-native'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render, screen} from '@testing-library/react-native'

import {type PostArticle} from '#/features/articles/articles'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {SectionedFrontPage} from './SectionedFrontPage'

jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  web: (style: unknown) => style,
  useTheme: () => ({
    atoms: new Proxy({}, {get: () => ({})}),
    palette: new Proxy({}, {get: () => '#000'}),
  }),
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('./useFrontPageColumns', () => ({
  useFrontPageColumns: () =>
    mockWidth - 32 >= 960 ? 3 : mockWidth - 32 >= 600 ? 2 : 1,
}))
jest.mock('../NewsCard', () => {
  const {Text: RNText} =
    require('react-native') as typeof import('react-native')
  return {
    NewsCard: ({
      size,
      article,
    }: {
      size: string
      article: {item: {uri: string}}
    }) => <RNText testID={`card:${article.item.uri}`}>{size}</RNText>,
  }
})

let mockWidth = 1440
const HOUR = 3_600_000
let next = 0

function story({
  publisher = 0,
  hoursAgo = 1,
  replies = 0,
  media = 'image',
  tag,
}: {
  publisher?: number
  hoursAgo?: number
  replies?: number
  media?: 'image' | 'video' | 'none'
  tag?: string
}): PostArticle {
  const id = next++
  const did = PUBLISHERS[publisher].did
  return {
    item: {
      uri: `at://${did}/app.bsky.feed.post/${id}`,
      record: {
        createdAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
        facets: tag
          ? [
              {
                index: {byteStart: 0, byteEnd: 1},
                features: [{$type: 'app.bsky.richtext.facet#tag', tag}],
              },
            ]
          : [],
      },
      post: {author: {did}, replyCount: replies, repostCount: 0},
    },
    title: `Story ${id}`,
    image: media === 'none' ? undefined : 'https://example.com/a.jpg',
    external:
      media === 'image'
        ? {uri: `https://e.com/${id}`, title: `Story ${id}`, thumb: 'x'}
        : undefined,
    media:
      media === 'video'
        ? {type: 'video', view: {presentation: undefined}}
        : undefined,
  } as unknown as PostArticle
}

function feed(count: number, media?: 'none') {
  next = 0
  return Array.from({length: count}, (_, i) =>
    story({
      publisher: i % 5,
      hoursAgo: 1 + i * 0.3,
      replies: (i * 7) % 11,
      media: media ?? (i % 6 === 0 ? 'video' : 'image'),
      tag: i % 3 === 0 ? 'climate' : undefined,
    }),
  )
}

function page(articles: readonly PostArticle[], shorts = true) {
  return (
    <I18nProvider i18n={i18n}>
      <SectionedFrontPage
        articles={articles}
        mode="discover"
        shorts={shorts ? <Text testID="shortsRow">Shorts</Text> : undefined}
      />
    </I18nProvider>
  )
}

function headings() {
  return screen
    .queryAllByTestId(/^sectionHeading-/)
    .map(node => node.props.testID as string)
}

beforeEach(() => {
  mockWidth = 1440
  i18n.loadAndActivate({locale: 'en', messages: {}})
})

it('renders the sections in order with Shorts after Video', () => {
  render(page(feed(60)))
  const ids = headings()
  expect(ids.slice(0, 3)).toEqual([
    'sectionHeading-top',
    'sectionHeading-popular',
    'sectionHeading-video',
  ])
  expect(ids.at(-1)).toBe('sectionHeading-latest')
  expect(ids.some(id => id.startsWith('sectionHeading-publisher-'))).toBe(true)
  expect(ids).toContain('sectionHeading-topic-climate')
  expect(screen.getByTestId('shortsRow')).toBeTruthy()
})

it('offers See all only on publisher and topic sections', () => {
  render(page(feed(60)))
  const links = screen.getAllByTestId(/^sectionSeeAll-/)
  for (const link of links)
    expect(link.props.testID).toMatch(/^sectionSeeAll-(publisher|topic)-/)
  expect(links.length).toBeGreaterThan(0)
})

it('leads Top stories with a Lead card on wide screens', () => {
  render(page(feed(60)))
  expect(screen.getAllByText(/^(lead|feature|standard)$/)[0]).toHaveTextContent(
    'lead',
  )
})

it('keeps every section above Latest unchanged when more stories load', () => {
  const first = feed(60)
  const view = render(page(first))
  const before = screen
    .getAllByTestId(/^card:/)
    .map(node => node.props.testID as string)
  next = 60
  const more = [
    ...first,
    ...Array.from({length: 20}, (_, i) =>
      story({publisher: i % 5, hoursAgo: 30 + i, replies: 9}),
    ),
  ]
  view.rerender(page(more))
  const after = screen
    .getAllByTestId(/^card:/)
    .map(node => node.props.testID as string)
  expect(after.slice(0, before.length)).toEqual(before)
})

it('falls back to 1+1+1 rows when nothing has media', () => {
  render(page(feed(60, 'none')))
  expect(screen.getAllByTestId(/^frontPageRow-/)[0].props.testID).toBe(
    'frontPageRow-1-1-1',
  )
})

it('shows only Top stories and Latest on a thin feed', () => {
  render(page(feed(12)))
  expect(headings()).toEqual(['sectionHeading-top', 'sectionHeading-latest'])
})

it('shows Top stories at once and adds the other sections when the second page lands', () => {
  const all = feed(60)
  const view = render(page(all.slice(0, 30)))
  expect(headings()).toEqual(['sectionHeading-top', 'sectionHeading-latest'])
  const topCards = () =>
    screen
      .getByTestId('section-top')
      .findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('card:'),
      )
      .map(node => node.props.testID as string)
  const before = topCards()
  view.rerender(page(all))
  expect(topCards()).toEqual(before)
  expect(headings()).toEqual(
    expect.arrayContaining(['sectionHeading-popular', 'sectionHeading-video']),
  )
})

it('drops a story from its frozen section when it leaves the feed', () => {
  const all = feed(60)
  const view = render(page(all))
  const popular = screen
    .getByTestId('section-popular')
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('card:'),
    )[0].props.testID as string
  const removed = popular.replace('card:', '')
  view.rerender(page(all.filter(article => article.item.uri !== removed)))
  expect(screen.queryByTestId(popular)).toBeNull()
  expect(headings()[0]).toBe('sectionHeading-top')
})

it('does not rebuild the page when moderation removes the first story', () => {
  const all = feed(60)
  const view = render(page(all))
  const topBefore = screen
    .getByTestId('section-top')
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('card:'),
    )
    .map(node => node.props.testID as string)
  view.rerender(page(all.slice(1)))
  const topAfter = screen
    .getByTestId('section-top')
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('card:'),
    )
    .map(node => node.props.testID as string)
  expect(topAfter).toEqual(
    topBefore.filter(id => id !== `card:${all[0].item.uri}`),
  )
})

it('appends newly loaded stories to the end of Latest', () => {
  const first = feed(60)
  const view = render(page(first))
  const latest = () =>
    screen
      .getByTestId('section-latest')
      .findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('card:'),
      )
      .map(node => node.props.testID as string)
  const before = latest()
  next = 100
  const newer = Array.from({length: 6}, (_, i) =>
    story({publisher: i % 5, hoursAgo: 0.1 + i * 0.01}),
  )
  view.rerender(page([...first, ...newer]))
  expect(latest().slice(0, before.length)).toEqual(before)
})

it('puts the See all link in a 44px touch area', () => {
  render(page(feed(60)))
  const link = screen.getAllByTestId(/^sectionSeeAll-/)[0]
  expect(link.props.hitSlop).toEqual({top: 10, bottom: 10, left: 8, right: 8})
})

it('shows only the dated stream, without a Latest heading, in latest mode', () => {
  render(
    <I18nProvider i18n={i18n}>
      <SectionedFrontPage articles={feed(60)} mode="latest" />
    </I18nProvider>,
  )
  expect(headings()).toEqual([])
  expect(screen.getAllByTestId(/^card:/)).toHaveLength(60)
})
