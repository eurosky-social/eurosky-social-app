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

it('lays stories out as a front page with Shorts inside it', () => {
  renderStories()
  expect(screen.getByTestId('frontPage')).toBeTruthy()
  expect(screen.getByTestId('homeShortsRow')).toBeTruthy()
})

it('shows skeleton cards while the first page loads', () => {
  mockFeed = {isPending: true}
  renderStories()
  expect(screen.getByTestId('frontPageSkeleton')).toBeTruthy()
  expect(screen.queryByTestId('frontPage')).toBeNull()
})
