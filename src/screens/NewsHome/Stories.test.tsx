import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render, screen} from '@testing-library/react-native'

import {NewsStories} from './Stories'

jest.mock('#/components/Layout', () => ({
  Content: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/lib/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({sentinel: null}),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))
jest.mock('#/features/articles/moderation', () => ({
  articleModeration: () => ({filter: false}),
}))
jest.mock('#/features/publishers/articles', () => ({
  articlesFromPublisherFeed: () => mockArticles,
}))
jest.mock('#/state/queries/post-feed', () => ({
  usePostFeedQuery: () => mockFeed,
}))
jest.mock('./ShortsRow', () => ({
  HomeShortsRow: () => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="homeShortsRow" />
  },
}))
jest.mock('#/features/newsCards/FrontPage', () => {
  const {View} = require('react-native') as typeof import('react-native')
  return {
    FrontPage: ({shorts}: {shorts?: React.ReactNode}) => (
      <View testID="frontPage">{shorts}</View>
    ),
    FrontPageSkeleton: () => <View testID="frontPageSkeleton" />,
  }
})
jest.mock('#/features/newsCards/FrontPage/SectionedFrontPage', () => {
  const {View} = require('react-native') as typeof import('react-native')
  return {
    SectionedFrontPage: ({
      shorts,
      mode,
      complete,
    }: {
      shorts?: React.ReactNode
      mode: string
      complete?: boolean
    }) => (
      <View testID="sectionedFrontPage" accessibilityHint={mode}>
        {complete ? <View testID="feedComplete" /> : null}
        {shorts}
      </View>
    ),
  }
})

let mockArticles: object[] = []
let mockFeed: Record<string, unknown> = {}

beforeEach(() => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  mockArticles = [{item: {uri: 'at://did:plc:pub/app.bsky.feed.post/1'}}]
  mockFeed = {isPending: false, data: {pages: [{slices: []}]}}
})

function renderStories() {
  return render(
    <I18nProvider i18n={i18n}>
      <NewsStories />
    </I18nProvider>,
  )
}

it('lays Discover out as a sectioned front page with Shorts', () => {
  renderStories()
  const page = screen.getByTestId('sectionedFrontPage')
  expect(page.props.accessibilityHint).toBe('discover')
  expect(screen.getByTestId('homeShortsRow')).toBeTruthy()
})

it('keeps Following personal: following mode without Shorts', () => {
  render(
    <I18nProvider i18n={i18n}>
      <NewsStories publisherDids={['did:plc:pub']} />
    </I18nProvider>,
  )
  expect(screen.getByTestId('sectionedFrontPage').props.accessibilityHint).toBe(
    'following',
  )
  expect(screen.queryByTestId('homeShortsRow')).toBeNull()
})

it('tells the page when the feed has no more stories', () => {
  mockFeed = {...mockFeed, hasNextPage: false}
  renderStories()
  expect(screen.getByTestId('feedComplete')).toBeTruthy()
})

it('shows skeleton cards while the first page loads', () => {
  mockFeed = {isPending: true}
  renderStories()
  expect(screen.getByTestId('frontPageSkeleton')).toBeTruthy()
  expect(screen.queryByTestId('sectionedFrontPage')).toBeNull()
})

it('fetches the second page straight away so Discover can build its sections', () => {
  const fetchNextPage = jest.fn()
  mockArticles = Array.from({length: 30}, (_, i) => ({
    item: {uri: `at://did:plc:pub/app.bsky.feed.post/${i}`},
  }))
  mockFeed = {...mockFeed, hasNextPage: true, fetchNextPage}
  renderStories()
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
})

it('does not prefetch for Following', () => {
  const fetchNextPage = jest.fn()
  mockArticles = Array.from({length: 30}, (_, i) => ({
    item: {uri: `at://did:plc:pub/app.bsky.feed.post/${i}`},
  }))
  mockFeed = {...mockFeed, hasNextPage: true, fetchNextPage}
  render(
    <I18nProvider i18n={i18n}>
      <NewsStories publisherDids={['did:plc:pub']} />
    </I18nProvider>,
  )
  expect(fetchNextPage).not.toHaveBeenCalled()
})

it('does not retry the prefetch after the second page fails', () => {
  const fetchNextPage = jest.fn()
  mockArticles = Array.from({length: 30}, (_, i) => ({
    item: {uri: `at://did:plc:pub/app.bsky.feed.post/${i}`},
  }))
  mockFeed = {
    ...mockFeed,
    hasNextPage: true,
    isFetchNextPageError: true,
    fetchNextPage,
  }
  renderStories()
  expect(fetchNextPage).not.toHaveBeenCalled()
})

it('stops prefetching after three pages', () => {
  const fetchNextPage = jest.fn()
  mockArticles = Array.from({length: 30}, (_, i) => ({
    item: {uri: `at://did:plc:pub/app.bsky.feed.post/${i}`},
  }))
  mockFeed = {
    ...mockFeed,
    hasNextPage: true,
    fetchNextPage,
    data: {pages: [{slices: []}, {slices: []}, {slices: []}]},
  }
  renderStories()
  expect(fetchNextPage).not.toHaveBeenCalled()
})

it('shows every story newest first on the News page, without Shorts or prefetch', () => {
  const fetchNextPage = jest.fn()
  mockArticles = Array.from({length: 30}, (_, i) => ({
    item: {uri: `at://did:plc:pub/app.bsky.feed.post/${i}`},
  }))
  mockFeed = {...mockFeed, hasNextPage: true, fetchNextPage}
  render(
    <I18nProvider i18n={i18n}>
      <NewsStories mode="latest" />
    </I18nProvider>,
  )
  expect(screen.getByTestId('sectionedFrontPage').props.accessibilityHint).toBe(
    'latest',
  )
  expect(screen.queryByTestId('homeShortsRow')).toBeNull()
  expect(fetchNextPage).not.toHaveBeenCalled()
})
