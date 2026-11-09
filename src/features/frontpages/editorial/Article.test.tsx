import {i18n} from '@lingui/core'
import {render, screen} from '@testing-library/react-native'

import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useBreakpoints} from '#/alf'
import {Link} from '#/components/Link'
import {Embed} from '#/components/Post/Embed'
import {ImageEmbed} from '#/components/Post/Embed/ImageEmbed'
import {VideoEmbed} from '#/components/Post/Embed/VideoEmbed'
import {RichText} from '#/components/RichText'
import {Article} from './Article'
import {articleFromPost} from './articles'

jest.mock('expo-image', () => ({
  Image: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: ({message}: {message: string}) => message,
    i18n: {
      date: () => 'Oct 28',
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat('en', options).format(value),
    },
  }),
  Trans: ({message}: {message: string}) => message,
}))
jest.mock('@bsky/sdk/moderation', () => ({
  mergeModUIResults: () => ({filter: false}),
  moderateViewExternal: () => ({ui: () => ({})}),
}))
jest.mock('#/state/cache/post-shadow', () => ({
  POST_TOMBSTONE: Symbol('deleted'),
  usePostShadow: jest.fn((post: unknown) => post),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useBreakpoints: jest.fn(() => ({gtMobile: true})),
  useTheme: () => ({atoms: new Proxy({}, {get: () => ({})})}),
}))
jest.mock('#/components/Link', () => {
  const {createElement} = require('react') as typeof import('react')
  const {View, Text} = require('react-native') as typeof import('react-native')
  return {
    Link: ({children, ...props}: {children: React.ReactNode}) =>
      createElement(View, props, children),
    InlineLinkText: Text,
  }
})
jest.mock('#/components/Button', () => ({
  ButtonText: (require('react-native') as typeof import('react-native')).Text,
  ButtonIcon: () => null,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/moderation/ContentHider', () => ({
  ContentHider: ({children}: {children: React.ReactNode}) => children,
}))
jest.mock('#/components/icons/Arrow', () => ({
  ArrowTopRight_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/Post/Embed', () => ({Embed: jest.fn(() => null)}))
jest.mock('#/components/RichText', () => {
  const {createElement} = require('react') as typeof import('react')
  const {Text} = require('react-native') as typeof import('react-native')
  return {
    RichText: jest.fn(({value, ...props}: {value: {text: string}}) =>
      createElement(Text, props, value.text),
    ),
  }
})
jest.mock('#/components/Post/Embed/ImageEmbed', () => ({
  ImageEmbed: jest.fn(() => null),
}))
jest.mock('#/components/Post/Embed/VideoEmbed', () => ({
  VideoEmbed: jest.fn(() => null),
}))

function article(
  embed?: Parameters<typeof articleFromPost>[0]['post']['embed'],
) {
  return articleFromPost({
    _reactKey: 'one',
    uri: 'at://did:plc:test/app.bsky.feed.post/one',
    post: {
      uri: 'at://did:plc:test/app.bsky.feed.post/one',
      cid: 'bafytest',
      author: {did: 'did:plc:test', handle: 'test.example'},
      record: {},
      indexedAt: '2026-10-28T12:00:00Z',
      embed,
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'A headline\nThe rest of the post.',
      createdAt: '2026-10-28T12:00:00Z',
    },
    moderation: {
      ui: () => ({}),
    } as unknown as Parameters<typeof articleFromPost>[0]['moderation'],
  })
}

/** Interactive media must never be inside the article navigation link. */
function expectOutsideLink<P>(component: React.ComponentType<P>) {
  let parent = screen.UNSAFE_getByType(component).parent
  while (parent) {
    expect(parent.type).not.toBe(Link)
    parent = parent.parent
  }
}

beforeEach(() => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  jest.clearAllMocks()
})

it('renders all photos in the shared carousel outside the headline link', () => {
  const story = article({
    $type: 'app.bsky.embed.images#view',
    images: [
      {
        thumb: 'https://cdn.example/1.jpg',
        fullsize: 'https://cdn.example/1.jpg',
        alt: 'First',
      },
      {
        thumb: 'https://cdn.example/2.jpg',
        fullsize: 'https://cdn.example/2.jpg',
        alt: 'Second',
      },
    ],
  })
  render(<Article article={story} />)
  expect(jest.mocked(ImageEmbed).mock.calls[0][0]).toMatchObject({
    embed: story.media,
    imageLayout: 'carousel',
    post: story.item.post,
  })
  expect(VideoEmbed).not.toHaveBeenCalled()
  expectOutsideLink(ImageEmbed)
  expect(screen.getByText('A headline\nThe rest of the post.')).toBeTruthy()
  expect(screen.queryByTestId('editorialStoryLink')).toBeNull()
})

it('renders videos with the shared player outside the headline link', () => {
  const story = article({
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://video.example/playlist.m3u8',
    thumbnail: 'https://video.example/thumbnail.jpg',
    alt: 'A video',
    aspectRatio: {width: 1920, height: 1080},
  })
  render(<Article article={story} />)
  expect(jest.mocked(VideoEmbed).mock.calls[0][0]).toMatchObject({
    embed: story.item.post.embed,
    post: story.item.post,
  })
  expect(ImageEmbed).not.toHaveBeenCalled()
  expectOutsideLink(VideoEmbed)
})

it('leaves text-only stories without a media component', () => {
  render(<Article article={article()} />)
  expect(ImageEmbed).not.toHaveBeenCalled()
  expect(VideoEmbed).not.toHaveBeenCalled()
  expect(screen.getByText('A headline\nThe rest of the post.')).toBeTruthy()
  expect(screen.queryByTestId('editorialStoryLink')).toBeNull()
})

it('shows a ghost comment button with only the reply count', () => {
  const story = article()
  story.item.post.replyCount = 3
  story.item.post.quoteCount = 9
  render(<Article article={story} />)
  const comments = screen.getByTestId('editorialComments')
  expect(comments.props).toMatchObject({
    to: '/profile/test.example/post/one',
    variant: 'ghost',
    color: 'secondary',
    size: 'small',
  })
  expect(screen.getByText('3')).toBeTruthy()
  expect(screen.queryByText(/Conversation/)).toBeNull()
})

it('shows like and repost counts linked to the appropriate people lists', () => {
  const story = article()
  story.item.post.likeCount = 11
  story.item.post.repostCount = 4
  render(<Article article={story} />)
  expect(screen.getByTestId('editorialLikes').props.to).toBe(
    '/profile/test.example/post/one/liked-by',
  )
  expect(screen.getByTestId('editorialLikes').props.variant).toBe('ghost')
  expect(screen.getByTestId('editorialReposts').props.variant).toBe('ghost')
  expect(screen.getByTestId('editorialReposts').props.to).toBe(
    '/profile/test.example/post/one/reposted-by',
  )
  expect(screen.getByText('11')).toBeTruthy()
  expect(screen.getByText('4')).toBeTruthy()
})

it('uses the normal compact post-count formatter for comments, reposts and likes', () => {
  const story = article()
  story.item.post.replyCount = 1500
  story.item.post.repostCount = 12600
  story.item.post.likeCount = 1000000
  render(<Article article={story} />)
  expect(screen.getByText('1.5K')).toBeTruthy()
  expect(screen.getByText('12K')).toBeTruthy()
  expect(screen.getByText('1M')).toBeTruthy()
})

it('keeps the headline linked to the publisher without a duplicate Read story button', () => {
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://www.wired.com/story/example',
      title: 'A story',
      description: '',
    },
  })
  render(<Article article={story} />)
  expect(
    screen
      .UNSAFE_getAllByType(Link)
      .some(link => link.props.to === 'https://www.wired.com/story/example'),
  ).toBe(true)
  expect(screen.queryByText('Read story')).toBeNull()
})

it('keeps full post text and facets above the media without overriding link colors', () => {
  const story = article({$type: 'app.bsky.embed.images#view', images: []})
  story.item.record.text = 'A story with #news and @example.com'
  story.item.record.facets = [
    {
      index: {byteStart: 13, byteEnd: 18},
      features: [{$type: 'app.bsky.richtext.facet#tag', tag: 'news'}],
    },
  ]
  render(<Article article={story} lead wide />)
  const props = jest.mocked(RichText).mock.calls[0][0]
  expect(props.value).toMatchObject({
    text: story.item.record.text,
    facets: story.item.record.facets,
  })
  expect(props).toMatchObject({
    enableTags: true,
    enableCode: true,
    shouldProxyLinks: true,
  })
  expect(props.style).toEqual([{fontSize: 20, lineHeight: 30}])
})

it('renders quote cards and unavailable-quote placeholders after the post text', () => {
  const story = article({
    $type: 'app.bsky.embed.record#view',
    record: {
      $type: 'app.bsky.embed.record#viewNotFound',
      uri: 'at://did:plc:other/app.bsky.feed.post/missing',
      notFound: true,
    },
  })
  render(<Article article={story} />)
  expect(jest.mocked(Embed).mock.calls[0][0]).toMatchObject({
    embed: story.quote,
    moderation: story.item.moderation,
  })
  expectOutsideLink(Embed)
  expect(screen.getByTestId('editorialPostText')).toBeTruthy()
  expect(screen.queryByTestId('editorialStoryLink')).toBeNull()
})

it('uses a compact thumbnail-and-headline row for small mobile articles', () => {
  jest.mocked(useBreakpoints).mockReturnValueOnce({
    gtMobile: false,
    gtPhone: false,
    gtTablet: false,
    activeBreakpoint: undefined,
  })
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://wired.com/story/mobile',
      title: 'A mobile headline',
      description: 'A summary that should not take space.',
      thumb: 'https://cdn.example/thumb.jpg',
    },
  })
  render(<Article article={story} size="small" />)
  expect(screen.getByText('A mobile headline').props.numberOfLines).toBe(3)
  expect(screen.queryByText('A summary that should not take space.')).toBeNull()
  expect(screen.getByTestId('editorialStoryLink')).toBeTruthy()
})

it('does not render media for deleted posts', () => {
  jest.mocked(usePostShadow).mockReturnValueOnce(POST_TOMBSTONE)
  render(<Article article={article()} />)
  expect(screen.toJSON()).toBeNull()
  expect(ImageEmbed).not.toHaveBeenCalled()
  expect(VideoEmbed).not.toHaveBeenCalled()
})
