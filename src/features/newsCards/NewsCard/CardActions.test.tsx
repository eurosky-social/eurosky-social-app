import {fireEvent, render, screen} from '@testing-library/react-native'

import {CardActions} from './CardActions'

jest.mock('@lingui/react', () => {
  const interpolate = ({
    message,
    values,
  }: {
    message: string
    values?: Record<string, string>
  }) => message.replace(/\{(\w+)\}/g, (_, key: string) => values?.[key] ?? '')
  const i18n = {
    _: interpolate,
    date: (date: Date, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-GB', options).format(date),
  }
  return {useLingui: () => ({_: interpolate, i18n})}
})
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  web: (style: unknown) => style,
  native: () => ({}),
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
jest.mock('#/components/PostControls/PostControlButton', () => {
  const {Pressable, View} =
    require('react-native') as typeof import('react-native')
  return {
    PostControlButton: Pressable,
    PostControlButtonIcon: View,
  }
})
jest.mock('#/components/PostControls/RepostButton', () => ({
  RepostButton: (props: {onQuote: () => void}) => {
    mockRepostProps(props)
    return null
  },
}))
jest.mock('#/components/PostControls/BookmarkButton', () => ({
  BookmarkButton: () => null,
}))
jest.mock('#/components/icons/Heart2', () => ({
  Heart2_Filled_Stroke2_Corner0_Rounded: () => null,
  Heart2_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/icons/Reply', () => ({
  Reply_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/Toast', () => ({
  show: (...args: unknown[]) => mockToast(...args),
}))
jest.mock('#/lib/hooks/useOpenComposer', () => ({
  useOpenComposer: () => ({openComposer: mockOpenComposer}),
}))
jest.mock('#/lib/hooks/useTimeAgo', () => ({
  useGetTimeAgo: () => (earlier: string, later: Date) =>
    `${Math.floor((later.getTime() - new Date(earlier).getTime()) / 60000)}m`,
}))
jest.mock('#/state/feed-feedback', () => ({
  useFeedFeedbackContext: () => ({
    feedDescriptor: undefined,
    sendInteraction: jest.fn(),
  }),
}))
jest.mock('#/state/queries/post', () => ({
  usePostLikeMutationQueue: () => [mockLike, mockUnlike],
  usePostRepostMutationQueue: () => [mockRepost, mockUnrepost],
}))
jest.mock('#/state/session', () => ({
  useRequireAuth: () => (fn: () => void) => mockRequireAuth(fn),
}))

const mockRepostProps = jest.fn<void, [{onQuote: () => void}]>()
const mockToast = jest.fn()
const mockOpenComposer = jest.fn()
const mockLike = jest.fn(async () => {})
const mockUnlike = jest.fn(async () => {})
const mockRepost = jest.fn(async () => {})
const mockUnrepost = jest.fn(async () => {})
let mockRequireAuth = (fn: () => void) => fn()

const NOW = new Date('2026-11-11T10:00:00Z')

function post(overrides: Record<string, unknown> = {}) {
  return {
    uri: 'at://did:plc:pub/app.bsky.feed.post/abc',
    cid: 'bafy',
    author: {did: 'did:plc:pub', handle: 'pub.example', viewer: {}},
    record: {},
    indexedAt: NOW.toISOString(),
    replyCount: 4,
    repostCount: 2,
    likeCount: 9,
    viewer: {},
    ...overrides,
  } as unknown as Parameters<typeof CardActions>[0]['post']
}

beforeEach(() => {
  jest.useFakeTimers({now: NOW})
  jest.clearAllMocks()
  mockRequireAuth = fn => fn()
})
afterEach(() => jest.useRealTimers())

it('links the counts and comment icon to the post, out of the tab order', () => {
  render(<CardActions post={post()} createdAt="2026-11-11T09:58:00Z" />)
  for (const id of [
    'newsCardCommentIcon',
    'newsCardCommentCount',
    'newsCardRepostCount',
    'newsCardLikeCount',
  ]) {
    const node = screen.getByTestId(id, {includeHiddenElements: true})
    expect(node.props.to).toBe('/profile/pub.example/post/abc')
    expect(node.props.tabIndex).toBe(-1)
    expect(node.props.accessibilityElementsHidden).toBe(true)
  }
  expect(
    screen.getByTestId('newsCardLikeCount', {includeHiddenElements: true}),
  ).toHaveTextContent('9')
})

it('toggles a like through the shared queue', () => {
  const {rerender} = render(
    <CardActions post={post()} createdAt="2026-11-11T09:58:00Z" />,
  )
  fireEvent.press(screen.getByTestId('newsCardLike'))
  expect(mockLike).toHaveBeenCalled()
  expect(screen.getByTestId('newsCardLike').props.accessibilityState).toEqual(
    expect.objectContaining({selected: false}),
  )
  rerender(
    <CardActions
      post={post({viewer: {like: 'at://like'}})}
      createdAt="2026-11-11T09:58:00Z"
    />,
  )
  expect(screen.getByTestId('newsCardLike').props.accessibilityState).toEqual(
    expect.objectContaining({selected: true}),
  )
  fireEvent.press(screen.getByTestId('newsCardLike'))
  expect(mockUnlike).toHaveBeenCalled()
})

it('refuses to like a blocked author', () => {
  render(
    <CardActions
      post={post({
        author: {
          did: 'did:plc:pub',
          handle: 'pub.example',
          viewer: {blocking: 'x'},
        },
      })}
      createdAt="2026-11-11T09:58:00Z"
    />,
  )
  fireEvent.press(screen.getByTestId('newsCardLike'))
  expect(mockToast).toHaveBeenCalledWith(
    'Cannot interact with a blocked user',
    expect.anything(),
  )
  expect(mockLike).not.toHaveBeenCalled()
})

it('asks a signed-out reader to sign in before liking', () => {
  mockRequireAuth = jest.fn()
  render(<CardActions post={post()} createdAt="2026-11-11T09:58:00Z" />)
  fireEvent.press(screen.getByTestId('newsCardLike'))
  expect(mockRequireAuth).toHaveBeenCalled()
  expect(mockLike).not.toHaveBeenCalled()
})

it('passes repost state to the repost menu without a count', () => {
  render(
    <CardActions
      post={post({viewer: {repost: 'at://repost'}})}
      createdAt="2026-11-11T09:58:00Z"
    />,
  )
  expect(mockRepostProps).toHaveBeenCalledWith(
    expect.objectContaining({
      isReposted: true,
      repostCount: undefined,
      embeddingDisabled: false,
    }),
  )
  const {onQuote} = mockRepostProps.mock.calls[0][0]
  onQuote()
  expect(mockOpenComposer).toHaveBeenCalledWith(
    expect.objectContaining({quote: expect.objectContaining({cid: 'bafy'})}),
  )
})

it('labels time relative under a day, then as a short date', () => {
  const {rerender} = render(
    <CardActions post={post()} createdAt="2026-11-11T09:58:00Z" />,
  )
  expect(screen.getByTestId('newsCardTime')).toHaveTextContent('2m ago')
  rerender(<CardActions post={post()} createdAt="2026-11-11T09:59:40Z" />)
  expect(screen.getByTestId('newsCardTime')).toHaveTextContent('Just now')
  rerender(<CardActions post={post()} createdAt="2026-11-06T09:00:00Z" />)
  expect(screen.getByTestId('newsCardTime')).toHaveTextContent('6 Nov')
})
