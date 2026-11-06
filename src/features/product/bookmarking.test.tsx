import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, render, renderHook} from '@testing-library/react-native'

import {updatePostShadow} from '#/state/cache/post-shadow'
import {useBookmarkMutation} from '#/state/queries/bookmarks/useBookmarkMutation'
import {useBookmarksQuery} from '#/state/queries/bookmarks/useBookmarksQuery'
import {BookmarkButton} from '#/components/PostControls/BookmarkButton'
import {getProduct, PRODUCT} from '#/config/product'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {
  assertBookmarkingEnabled,
  BookmarkingUnavailableError,
} from './bookmarking'
import {isProductRouteAvailable} from './routes'

jest.mock('#/state/session', () => ({
  useAppviewClient: () => ({call: mockCall}),
  useRequireAuth: () => (action: () => void) => action(),
}))
jest.mock('#/state/cache/post-shadow', () => ({updatePostShadow: jest.fn()}))
jest.mock('#/state/feed-feedback', () => ({useFeedFeedbackContext: () => ({})}))
jest.mock('#/state/queries/util', () => ({}))
jest.mock('#/lib/hooks/useCleanError', () => ({
  useCleanError: () => () => ({clean: 'Error'}),
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/analytics', () => ({useAnalytics: () => ({metric: jest.fn()})}))
jest.mock('#/alf', () => ({useTheme: () => ({palette: {primary_500: '#f09'}})}))
jest.mock('#/components/PostControls/PostControlButton', () => {
  const {View} = require('react-native') as typeof import('react-native')
  return {PostControlButton: View, PostControlButtonIcon: () => null}
})
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

const mockCall = jest.fn(() => Promise.resolve({}))
const post = {
  uri: 'at://did:plc:test/app.bsky.feed.post/one',
  cid: 'bafytest',
  author: {did: 'did:plc:test'},
  viewer: {},
} as unknown as React.ComponentProps<typeof BookmarkButton>['post']
function wrapper({children}: {children: React.ReactNode}) {
  return (
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </QueryClientProvider>
  )
}
let client: QueryClient
beforeEach(() => {
  jest.clearAllMocks()
  i18n.loadAndActivate({locale: 'en', messages: {}})
  client = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
  jest.replaceProperty(PRODUCT, 'id', 'news')
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
})
afterEach(() => {
  client.clear()
  jest.restoreAllMocks()
})
it('hides bookmark controls on nonpublisher posts before their hooks mount, while enabling Saved', () => {
  expect(
    render(<BookmarkButton post={post} logContext="FeedItem" />).queryByTestId(
      'postBookmarkBtn',
    ),
  ).toBeNull()
  expect(isProductRouteAvailable('Bookmarks', getProduct('news'))).toBe(true)
  expect(isProductRouteAvailable('Bookmarks', getProduct('social'))).toBe(true)
  expect(() => assertBookmarkingEnabled(getProduct('news'))).not.toThrow()
})
it('preserves the enabled social bookmark button', () => {
  jest.replaceProperty(PRODUCT, 'id', 'social')
  jest.replaceProperty(
    PRODUCT,
    'capabilities',
    getProduct('social').capabilities,
  )
  expect(
    render(<BookmarkButton post={post} logContext="FeedItem" />, {
      wrapper,
    }).getByTestId('postBookmarkBtn'),
  ).toBeTruthy()
})
it.each(['create', 'delete'] as const)(
  'rejects %s before optimistic changes, writes, or rollback changes',
  async action => {
    const {result} = renderHook(() => useBookmarkMutation(), {wrapper})
    await act(async () => {
      await expect(
        result.current.mutateAsync(
          action === 'create' ? {action, post} : {action, uri: post.uri},
        ),
      ).rejects.toBeInstanceOf(BookmarkingUnavailableError)
    })
    expect(mockCall).not.toHaveBeenCalled()
    expect(updatePostShadow).not.toHaveBeenCalled()
  },
)
it('allows bookmark controls and writes on configured publisher posts', async () => {
  const publisherPost = {
    ...post,
    uri: `at://${PUBLISHERS[0].did}/app.bsky.feed.post/one` as const,
    author: {...post.author, did: PUBLISHERS[0].did},
  }
  expect(
    render(<BookmarkButton post={publisherPost} logContext="FeedItem" />, {
      wrapper,
    }).getByTestId('postBookmarkBtn'),
  ).toBeTruthy()
  const {result} = renderHook(() => useBookmarkMutation(), {wrapper})
  await act(async () => {
    await result.current.mutateAsync({action: 'create', post: publisherPost})
  })
  expect(mockCall).toHaveBeenCalledTimes(1)
  expect(updatePostShadow).toHaveBeenCalledWith(client, publisherPost.uri, {
    bookmarked: true,
  })
})
it('does not fetch disabled bookmarks even on explicit refetch', async () => {
  jest.replaceProperty(PRODUCT, 'capabilities', {
    ...getProduct('news').capabilities,
    bookmarking: false,
  })
  const {result} = renderHook(() => useBookmarksQuery(), {wrapper})
  expect(mockCall).not.toHaveBeenCalled()
  await act(async () => {
    await result.current.refetch()
  })
  expect(mockCall).not.toHaveBeenCalled()
})
