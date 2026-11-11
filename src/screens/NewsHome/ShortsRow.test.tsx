import {render, screen} from '@testing-library/react-native'

import {type FeedPostSlice} from '#/state/queries/post-feed'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {HomeShortsRow} from './ShortsRow'

jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: ({message}: {message: string}) => message,
    i18n: {_: ({message}: {message: string}) => message},
  }),
  Trans: ({message}: {message: string}) => message,
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  web: (style: unknown) => style,
  useBreakpoints: () => ({gtMobile: true}),
}))
jest.mock('expo-image', () => ({
  Image: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (require('react-native') as typeof import('react-native'))
    .View,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/ProfileCard', () => ({
  Avatar: (props: {size: number}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="homeShortAvatar" {...props} />
  },
}))
jest.mock('#/components/moderation/ContentHider', () => ({
  ContentHider: ({children}: React.PropsWithChildren<{}>) => children,
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => mockOpts,
}))
jest.mock('#/state/cache/post-shadow', () => {
  const POST_TOMBSTONE = Symbol('deleted')
  return {
    POST_TOMBSTONE,
    usePostShadow: (post: {uri: string}) =>
      post.uri.endsWith('deleted') ? POST_TOMBSTONE : post,
  }
})
jest.mock('#/state/queries/post-feed', () => ({
  usePostFeedQuery: (descriptor: string) => {
    mockQuery(descriptor)
    return {data: {pages: [{slices: mockSlices}]}}
  },
}))
jest.mock('#/features/articles/moderation', () => ({
  articleModeration: (article: {item: {uri: string}}) => ({
    filter: article.item.uri.endsWith('filtered'),
  }),
}))

const mockQuery = jest.fn()
let mockOpts: object | undefined = {}
let mockSlices: FeedPostSlice[] = []
function slice(
  id: string,
  gif = false,
  publisher: (typeof PUBLISHERS)[number] = PUBLISHERS[0],
) {
  const uri = `at://${publisher.did}/app.bsky.feed.post/${id}`
  const record = {
    $type: 'app.bsky.feed.post',
    text: `Real video ${id}`,
    createdAt: '2026-11-06T12:00:00Z',
  }
  return {
    feedPostUri: uri,
    items: [
      {
        uri,
        record,
        post: {
          uri,
          cid: 'bafytest',
          author: {did: publisher.did, handle: publisher.domain},
          record,
          indexedAt: record.createdAt,
          embed: {
            $type: 'app.bsky.embed.video#view',
            cid: 'bafyvideo',
            playlist: 'https://video.example/stream.m3u8',
            thumbnail: 'https://example.com/thumb.jpg',
            presentation: gif ? 'gif' : 'default',
          },
        },
        moderation: {ui: () => ({})},
      },
    ],
  } as unknown as FeedPostSlice
}
beforeEach(() => {
  mockOpts = {}
  mockSlices = []
  mockQuery.mockClear()
})
it('renders real captions and source names, linking each thumbnail to that clip in Shorts', () => {
  mockSlices = [slice('one'), slice('two')]
  render(<HomeShortsRow />)
  expect(mockQuery).toHaveBeenCalledWith('publishers|videos')
  const links = screen.getAllByTestId('homeShortCard')
  expect(links).toHaveLength(2)
  expect(links[1].props.to).toEqual({
    screen: 'Shorts',
    params: {initialPostUri: mockSlices[1].feedPostUri},
  })
  expect(screen.getByText('Real video two')).toBeTruthy()
  expect(screen.getAllByText('WIRED')).toHaveLength(2)
  expect(screen.queryByText(/views/i)).toBeNull()
})
it('filters Following thumbnails while sharing the destination Shorts cache and exact selected URI', () => {
  mockSlices = [slice('followed'), slice('other', false, PUBLISHERS[1])]
  render(<HomeShortsRow publisherDids={[PUBLISHERS[0].did]} />)
  expect(mockQuery).toHaveBeenCalledWith('publishers|videos')
  expect(screen.getAllByTestId('homeShortCard')).toHaveLength(1)
  expect(screen.queryByText('Real video other')).toBeNull()
  expect(screen.getByTestId('homeShortCard').props.to).toEqual(
    expect.objectContaining({
      params: {initialPostUri: mockSlices[0].feedPostUri},
    }),
  )
})
it('omits GIFs, filtered posts and deleted shadows, and limits the row to ten thumbnails', () => {
  mockSlices = [
    slice('gif', true),
    slice('filtered'),
    slice('deleted'),
    ...Array.from({length: 14}, (_, index) => slice(`${index}`)),
  ]
  render(<HomeShortsRow />)
  expect(screen.queryByText('Real video gif')).toBeNull()
  expect(screen.queryByText('Real video filtered')).toBeNull()
  expect(screen.queryByText('Real video deleted')).toBeNull()
  expect(screen.getAllByTestId('homeShortCard').length).toBeLessThanOrEqual(10)
})
it('does not insert an empty or unmoderated section', () => {
  const {rerender} = render(<HomeShortsRow />)
  expect(screen.toJSON()).toBeNull()
  mockSlices = [slice('one')]
  mockOpts = undefined
  rerender(<HomeShortsRow />)
  expect(screen.toJSON()).toBeNull()
})
it('sets captions in three lines of 15px Semibold with the publisher logo', () => {
  mockSlices = [slice('one')]
  render(<HomeShortsRow />)
  const caption = screen.getByTestId('homeShortCaption')
  expect(caption.props.numberOfLines).toBe(3)
  expect(caption.props.style).toEqual(
    expect.arrayContaining([
      expect.objectContaining({fontSize: 15, lineHeight: 19}),
    ]),
  )
  expect(screen.getByTestId('homeShortAvatar').props.size).toBe(16)
  expect(screen.getByTestId('homeShortsHeading')).toHaveTextContent('Shorts')
})
