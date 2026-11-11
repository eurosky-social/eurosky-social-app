import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {
  type FeedPostSlice,
  type FeedPostSliceItem,
} from '#/state/queries/post-feed'
import {useProfileQuery} from '#/state/queries/profile'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {PublisherDirectoryScreen} from './Directory'
import {PublisherScreen} from './index'

jest.mock('#/alf', () => ({
  atoms: {px_lg: {paddingHorizontal: 16}, border_b: {borderBottomWidth: 1}},
  web: (value: unknown) => value,
  useTheme: () => ({atoms: {}, palette: {contrast_500: '#888'}}),
}))
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}))
jest.mock('#/lib/hooks/useSetTitle', () => ({useSetTitle: jest.fn()}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (value: unknown) => value,
  useMaybeProfileShadow: (value: unknown) => value,
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => mockModerationOpts,
}))
jest.mock('#/state/queries/profile', () => ({
  useProfileQuery: jest.fn(() => mockProfile),
}))
jest.mock('#/state/queries/post-feed', () => ({
  usePostFeedQuery: (...args: unknown[]) => {
    mockFeedQuery(...args)
    return mockFeed
  },
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: {did: 'did:plc:reader'}}),
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderateProfile: () => ({ui: () => ({})}),
}))
jest.mock('#/features/articles/moderation', () => ({
  articleModeration: (article: {item: {uri: string}}) => ({
    filter: article.item.uri.endsWith('filtered'),
  }),
}))
jest.mock('#/features/newsCards/FrontPage', () => ({
  FrontPage: (props: unknown) => {
    mockFrontPage(props)
    return null
  },
  FrontPageSkeleton: () => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="frontPageSkeleton" />
  },
}))
jest.mock('#/components/Layout', () => {
  const {View, Text} = require('react-native') as typeof import('react-native')
  return {
    Screen: View,
    Content: View,
    Header: {
      Outer: View,
      Content: View,
      TitleText: Text,
      BackButton: ({onPress}: {onPress?: () => void}) => {
        const {Pressable} =
          require('react-native') as typeof import('react-native')
        return (
          <Pressable
            accessibilityRole="button"
            testID="publisherBack"
            onPress={onPress}
          />
        )
      },
    },
  }
})
jest.mock('#/components/Button', () => {
  const {Pressable, Text} =
    require('react-native') as typeof import('react-native')
  return {Button: Pressable, ButtonText: Text}
})
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
  InlineLinkText: (require('react-native') as typeof import('react-native'))
    .Text,
}))
jest.mock('#/components/ProfileBadges', () => ({ProfileBadges: () => null}))
jest.mock('#/features/profileLinks', () => ({
  ProfileHeaderLinks: (props: unknown) => {
    mockProfileLinks(props)
    return null
  },
}))
jest.mock('#/components/RichText', () => ({
  RichText: ({value, ...props}: {value: {text: string}}) => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text {...props}>{value.text}</Text>
  },
}))
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/moderation/ScreenHider', () => ({
  ScreenHider: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/ProfileCard', () => ({
  FollowButton: (props: unknown) => {
    mockFollowButton(props)
    return null
  },
}))
jest.mock('#/view/com/util/UserAvatar', () => ({
  UserAvatar: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="publisherAvatar" {...props} />
  },
}))
jest.mock('#/view/screens/NotFound', () => ({
  NotFoundScreen: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Not found</Text>
  },
}))
/** Importing either editor/aggregator path would fail, even with news v2 disabled. */
jest.mock('#/features/frontpages/editorial/state', () => {
  throw new Error('Publisher must not load curation')
})
jest.mock('#/features/news/dutch/queries', () => {
  throw new Error('Publisher must not load aggregator')
})

const mockProfileLinks = jest.fn()
const mockFollowButton = jest.fn()
const mockFeedQuery = jest.fn()
const mockFrontPage = jest.fn()
const mockNavigate = jest.fn()
const refetch = jest.fn()
const fetchNextPage = jest.fn()
let mockModerationOpts: object | undefined = {}
let mockProfile: {
  data?: {
    did: string
    handle: string
    avatar?: string
    description?: string
    followersCount?: number
    followsCount?: number
    postsCount?: number
    viewer?: {blocking: string}
  }
  isError?: boolean
  refetch: typeof refetch
}
let mockFeed: {
  data?: {pages: {slices: FeedPostSlice[]}[]}
  isPending: boolean
  isError?: boolean
  hasNextPage?: boolean
  isFetching?: boolean
  isFetchNextPageError?: boolean
  refetch: typeof refetch
  fetchNextPage: typeof fetchNextPage
}
const did = PUBLISHERS[0].did
function item(
  id: string,
  author: string = did,
  reply = false,
): FeedPostSliceItem {
  return {
    uri: `at://${author}/app.bsky.feed.post/${id}`,
    post: {
      uri: `at://${author}/app.bsky.feed.post/${id}`,
      author: {did: author},
    },
    record: {
      text: id,
      createdAt: '2026-01-01T00:00:00Z',
      ...(reply ? {reply: {}} : {}),
    },
  } as unknown as FeedPostSliceItem
}
function renderPublisher(publisher = 'wired') {
  const props = {
    route: {params: {publisher}},
    navigation: {canGoBack: () => false, navigate: mockNavigate},
  } as unknown as React.ComponentProps<typeof PublisherScreen>
  return render(
    <I18nProvider i18n={i18n}>
      <PublisherScreen {...props} />
    </I18nProvider>,
  )
}
beforeEach(() => {
  jest.clearAllMocks()
  i18n.loadAndActivate({locale: 'en', messages: {}})
  mockModerationOpts = {}
  mockProfile = {
    data: {
      did,
      handle: 'wired.com',
      avatar: 'https://cdn.test/publisher.jpg',
      description: 'Reporting and analysis. https://wired.com/about',
      followersCount: 120,
      followsCount: 99,
      postsCount: 45,
    },
    refetch,
  }
  mockFeed = {
    data: {
      pages: [
        {
          slices: [
            {
              items: [
                item('one'),
                item('reply', did, true),
                item('filtered'),
                item('other', 'did:plc:other'),
              ],
            } as FeedPostSlice,
          ],
        },
      ],
    },
    isPending: false,
    refetch,
    fetchNextPage,
  }
})
it('shows padded publisher identities, avatars and follows without loading stories', () => {
  const screen = render(
    <I18nProvider i18n={i18n}>
      <PublisherDirectoryScreen />
    </I18nProvider>,
  )
  expect(screen.getByTestId('publisherDirectoryScreen')).toBeTruthy()
  for (const publisher of PUBLISHERS) {
    expect(screen.getByTestId(`publisher-${publisher.id}`).props.to).toEqual({
      screen: 'Publisher',
      params: {publisher: publisher.id},
    })
    expect(screen.getByText(publisher.name)).toBeTruthy()
  }
  for (const publisher of PUBLISHERS)
    expect(useProfileQuery).toHaveBeenCalledWith({did: publisher.did})
  expect(screen.getAllByTestId('publisherAvatar')).toHaveLength(
    PUBLISHERS.length,
  )
  expect(mockFollowButton).toHaveBeenCalledTimes(PUBLISHERS.length)
  expect(mockFollowButton).toHaveBeenCalledWith(
    expect.objectContaining({profile: expect.objectContaining({did})}),
  )
  expect(mockFollowButton).not.toHaveBeenCalledWith(
    expect.objectContaining({labels: expect.anything()}),
  )
  expect(screen.getAllByTestId('publisherCard')).toHaveLength(PUBLISHERS.length)
  expect(
    screen.getByTestId('publisherDirectoryList').props.style,
  ).toContainEqual({paddingHorizontal: 16})
  expect(mockFeedQuery).not.toHaveBeenCalled()
  expect(mockFrontPage).not.toHaveBeenCalled()
})
it('waits for moderation before showing directory avatars or follow actions', () => {
  mockModerationOpts = undefined
  const screen = render(
    <I18nProvider i18n={i18n}>
      <PublisherDirectoryScreen />
    </I18nProvider>,
  )
  for (const avatar of screen.getAllByTestId('publisherAvatar'))
    expect(avatar.props.avatar).toBeUndefined()
  expect(mockFollowButton).not.toHaveBeenCalled()
  expect(mockFeedQuery).not.toHaveBeenCalled()
})

it('groups the larger identity and follow with profile details, leaving only back above the scrolling content', () => {
  const screen = renderPublisher()
  expect(screen.queryByText('Publishers')).toBeNull()
  expect(screen.getAllByTestId('publisherIdentity')).toHaveLength(1)
  expect(screen.getByTestId('publisherBackRow')).toBeTruthy()
  expect(screen.getByTestId('publisherAvatar').props.size).toBe(64)
  expect(screen.getByTestId('publisherAvatar').props.avatar).toBe(
    'https://cdn.test/publisher.jpg',
  )
  expect(screen.getByTestId('publisherIdentity').props.to).toEqual({
    screen: 'Profile',
    params: {name: did},
  })
  expect(mockFollowButton).not.toHaveBeenCalledWith(
    expect.objectContaining({labels: expect.anything()}),
  )
  expect(screen.getByText(/@wired\.com/)).toBeTruthy()
  expect(screen.getByTestId('publisherDescription').props.children).toBe(
    mockProfile.data?.description,
  )
  expect(screen.getByTestId('profileHeaderFollowersButton')).toBeTruthy()
  expect(screen.queryByTestId('profileHeaderFollowsButton')).toBeNull()
  expect(screen.getByText(/45/)).toBeTruthy()
  expect(mockProfileLinks).toHaveBeenCalledWith(
    expect.objectContaining({
      profile: expect.objectContaining({did}),
      hidden: false,
    }),
  )
  for (const publisher of PUBLISHERS)
    expect(screen.queryByTestId(`publisher-${publisher.id}`)).toBeNull()
  expect(mockFeedQuery).toHaveBeenCalledWith(
    `author|${did}|posts_no_replies`,
    undefined,
    {enabled: true},
  )
  expect(mockFrontPage).toHaveBeenCalledWith({
    articles: [
      expect.objectContaining({
        item: expect.objectContaining({uri: item('one').uri}),
      }),
    ],
  })
  expect(screen.queryByText('Edit front page')).toBeNull()
})
it('resolves deep-linked publisher selection independently of the aggregator', () => {
  const screen = renderPublisher('the-verge')
  expect(useProfileQuery).toHaveBeenCalledWith({did: PUBLISHERS[1].did})
  expect(screen.getByText('The Verge')).toBeTruthy()
  expect(screen.queryByTestId('publisher-wired')).toBeNull()
})
it('returns directly opened publisher details to the directory when there is no back stack', () => {
  const screen = renderPublisher()
  const preventDefault = jest.fn()
  fireEvent.press(screen.getByTestId('publisherBack'), {preventDefault})
  expect(preventDefault).toHaveBeenCalledTimes(1)
  expect(mockNavigate).toHaveBeenCalledWith('PublisherDirectory')
})
it('does not fetch for an unknown publisher', () => {
  expect(
    renderPublisher('unknown').getByText('Publisher not found.'),
  ).toBeTruthy()
  expect(useProfileQuery).not.toHaveBeenCalled()
  expect(mockFeedQuery).not.toHaveBeenCalled()
})
it('never enables a blocked account feed', () => {
  mockProfile.data!.viewer = {blocking: 'at://block'}
  const screen = renderPublisher()
  expect(mockFeedQuery).toHaveBeenCalledWith(expect.any(String), undefined, {
    enabled: false,
  })
  expect(mockFrontPage).not.toHaveBeenCalled()
  expect(
    screen.getByText('Posts are unavailable for this account.'),
  ).toBeTruthy()
})
it('loads more automatically near the bottom without a More stories button', () => {
  mockFeed.hasNextPage = true
  const screen = renderPublisher()
  fetchNextPage.mockResolvedValue(undefined)
  expect(screen.queryByTestId('publisherMoreStories')).toBeNull()
  fireEvent.scroll(screen.getByTestId('publisherArticlesScroll'), {
    nativeEvent: {
      contentOffset: {y: 1400},
      contentSize: {height: 2000},
      layoutMeasurement: {height: 800},
    },
  })
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
})
it('does not offer pagination after the final page', () => {
  expect(renderPublisher().queryByTestId('publisherMoreStories')).toBeNull()
})
it('renders profile failures with retry', () => {
  mockProfile = {isError: true, refetch}
  const screen = renderPublisher()
  fireEvent.press(screen.getByText('Try again'))
  expect(refetch).toHaveBeenCalledTimes(1)
  expect(mockFeedQuery).not.toHaveBeenCalled()
})
it('renders an empty feed', () => {
  mockFeed.data = {pages: [{slices: []}]}
  expect(renderPublisher().getByText('No stories yet.')).toBeTruthy()
})
it('keeps existing stories visible after a pagination error and retries older stories', () => {
  mockFeed.isError = true
  mockFeed.isFetchNextPageError = true
  const screen = renderPublisher()
  expect(mockFrontPage).toHaveBeenCalled()
  fireEvent.press(screen.getByText('Try again'))
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
})

it('shows skeleton cards while the publisher feed loads', () => {
  mockFeed = {...mockFeed, isPending: true, data: undefined}
  const screen = renderPublisher()
  expect(
    screen.getByTestId('frontPageSkeleton', {includeHiddenElements: true}),
  ).toBeTruthy()
  expect(mockFrontPage).not.toHaveBeenCalled()
})

it('leaves the line under the profile to the story grid, so there is only one', () => {
  const screen = renderPublisher()
  const style = Object.assign(
    {},
    ...[screen.getByTestId('publisherProfileDetails').props.style]
      .flat(Infinity)
      .filter(Boolean),
  ) as Record<string, unknown>
  expect(style.borderBottomWidth ?? 0).toBe(0)
})
