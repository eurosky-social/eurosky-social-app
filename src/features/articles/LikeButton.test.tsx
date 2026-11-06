import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {act, fireEvent, render} from '@testing-library/react-native'

import {PostControlButton} from '#/components/PostControls/PostControlButton'
import * as Toast from '#/components/Toast'
import {ArticleLikeButton} from './LikeButton'

jest.mock('#/state/feed-feedback', () => ({useFeedFeedbackContext: () => ({})}))
jest.mock('#/state/queries/post', () => ({
  usePostLikeMutationQueue: () => [mockLike, mockUnlike],
}))
jest.mock('#/state/session', () => ({useRequireAuth: () => mockRequireAuth}))
jest.mock('#/alf', () => ({
  atoms: {flex_col: {flexDirection: 'column'}, gap_xs: {gap: 4}},
  useTheme: () => ({palette: {pink: '#f09'}}),
}))
jest.mock('#/components/PostControls/PostControlButton', () => {
  const {Pressable, Text} =
    require('react-native') as typeof import('react-native')
  return {
    PostControlButton: jest.fn(
      (props: React.ComponentProps<typeof Pressable>) =>
        (require('react') as typeof import('react')).createElement(
          Pressable,
          props,
        ),
    ),
    PostControlButtonText: Text,
    PostControlButtonIcon: () => null,
  }
})
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

const mockLike = jest.fn(() => Promise.resolve())
const mockUnlike = jest.fn(() => Promise.resolve())
const mockRequireAuth = jest.fn((action: () => Promise<void>) => action())
function post(liked = false, blocked = false) {
  return {
    uri: 'at://did:plc:publisher/app.bsky.feed.post/one',
    cid: 'bafytest',
    author: {
      did: 'did:plc:publisher',
      handle: 'publisher.test',
      viewer: blocked ? {blockedBy: true} : {},
    },
    viewer: liked ? {like: 'at://did:plc:reader/app.bsky.feed.like/one'} : {},
    likeCount: liked ? 12 : 11,
  } as unknown as React.ComponentProps<typeof ArticleLikeButton>['post']
}
function root(value: React.ComponentProps<typeof ArticleLikeButton>['post']) {
  return (
    <I18nProvider i18n={i18n}>
      <ArticleLikeButton post={value} />
    </I18nProvider>
  )
}
async function press(screen: ReturnType<typeof render>) {
  await act(async () => {
    fireEvent.press(screen.getByTestId('editorialLikes'), {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    })
    await Promise.resolve()
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  i18n.loadAndActivate({locale: 'en', messages: {}})
  mockRequireAuth.mockImplementation(action => action())
  mockLike.mockResolvedValue()
})
it('likes the original post rather than navigating, and unlikes from the shared shadow state', async () => {
  const screen = render(root(post()))
  expect(screen.getByTestId('editorialLikes').props.to).toBeUndefined()
  await press(screen)
  expect(mockLike).toHaveBeenCalledTimes(1)
  expect(mockUnlike).not.toHaveBeenCalled()
  screen.rerender(root(post(true)))
  expect(screen.getByTestId('editorialLikes').props.active).toBe(true)
  expect(screen.getByText('12')).toBeTruthy()
  await press(screen)
  expect(mockUnlike).toHaveBeenCalledTimes(1)
})
it('does not override the shared horizontal spacing with an undefined style', () => {
  const screen = render(root(post()))
  expect(screen.getByTestId('editorialLikes')).toBeTruthy()
  expect(jest.mocked(PostControlButton).mock.calls[0][0]).not.toHaveProperty(
    'style',
  )
})
it('keeps vertical video counts below the heart with a gap', () => {
  const screen = render(
    <I18nProvider i18n={i18n}>
      <ArticleLikeButton post={post()} vertical />
    </I18nProvider>,
  )
  expect(screen.getByTestId('editorialLikes')).toBeTruthy()
  expect(jest.mocked(PostControlButton).mock.calls[0][0].style).toEqual([
    {flexDirection: 'column'},
    {gap: 4},
  ])
})
it('requires authentication before mutating', async () => {
  mockRequireAuth.mockImplementation(() => Promise.resolve())
  const screen = render(root(post()))
  await press(screen)
  expect(mockRequireAuth).toHaveBeenCalled()
  expect(mockLike).not.toHaveBeenCalled()
})
it('does not like a blocked author', async () => {
  const screen = render(root(post(false, true)))
  await press(screen)
  expect(mockLike).not.toHaveBeenCalled()
  expect(Toast.show).toHaveBeenCalledWith(expect.any(String), {type: 'warning'})
})
it('reports failed writes instead of leaving an unhandled rejection', async () => {
  mockLike.mockRejectedValueOnce(new Error('offline'))
  const screen = render(root(post()))
  await press(screen)
  expect(Toast.show).toHaveBeenCalledWith(expect.any(String), {type: 'error'})
})
