import {Dimensions, Text} from 'react-native'
import {i18n} from '@lingui/core'
import {render, screen} from '@testing-library/react-native'

import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useBreakpoints} from '#/alf'
import {Link} from '#/components/Link'
import {Embed} from '#/components/Post/Embed'
import {ImageEmbed} from '#/components/Post/Embed/ImageEmbed'
import {VideoEmbed} from '#/components/Post/Embed/VideoEmbed'
import {RichText} from '#/components/RichText'
import {PRODUCT} from '#/config/product'
import {Article} from './Article'
import {articleFromPost} from './articles'
import {ArticleLikeButton} from './LikeButton'

jest.mock('#/components/PostControls/BookmarkButton', () => ({
  BookmarkButton: () => null,
}))

jest.mock('./LikeButton', () => {
  const {View, Text} = require('react-native') as typeof import('react-native')
  const {useFormatPostStatCount} =
    require('#/components/PostControls/util') as typeof import('#/components/PostControls/util')
  return {
    ArticleLikeButton: jest.fn(({post}: {post: {likeCount?: number}}) => (
      <View testID="editorialLikes">
        <Text>{useFormatPostStatCount()(post.likeCount ?? 0)}</Text>
      </View>
    )),
  }
})

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
  web: (style: unknown) => style,
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

it('uses the expanded article presentation in a thread without duplicating engagement controls or truncating the summary', () => {
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://example.com/story',
      title: 'A real headline',
      description: 'A full article summary',
      thumb: 'https://example.com/photo.jpg',
    },
  })
  render(<Article article={story} presentation="thread" lead size="big" />)
  expect(screen.getByText('A real headline')).toBeTruthy()
  expect(screen.getByTestId('editorialStoryLink').props.to).toBe(story.url)
  expect(
    screen.getByText('A full article summary').props.numberOfLines,
  ).toBeUndefined()
  expect(screen.getByTestId('editorialPostText').props.selectable).toBe(true)
  expect(screen.queryByTestId('editorialPostStats')).toBeNull()
  expect(ArticleLikeButton).not.toHaveBeenCalled()
})

it.each(['A real headline', ''])(
  'opens the original post from a reader preview with title %j, including its image',
  title => {
    const story = article({
      $type: 'app.bsky.embed.external#view',
      external: {
        uri: 'https://example.com/story',
        title,
        description: 'A real summary',
        thumb: 'https://example.com/photo.jpg',
      },
    })
    render(<Article article={story} linkTo="post" />)
    expect(screen.getByTestId('editorialStoryLink').props.to).toBe(
      '/profile/test.example/post/one',
    )
    expect(screen.getByLabelText(story.imageAlt).props.accessibilityHint).toBe(
      'Opens the post',
    )
    expect(screen.getByTestId('editorialComments').props.to).toBe(
      '/profile/test.example/post/one',
    )
  },
)

it.each(['small', 'big'] as const)(
  'puts the source on its own row only for %s articles',
  size => {
    render(
      <Article
        article={article()}
        size={size}
        compact={size === 'small'}
        byline={<Text testID="testSource">WIRED</Text>}
      />,
    )
    if (size === 'small') {
      expect(
        screen
          .getByTestId('editorialPublisherRow')
          .findByProps({testID: 'testSource'}),
      ).toBeTruthy()
    } else {
      expect(screen.queryByTestId('editorialPublisherRow')).toBeNull()
      expect(
        screen
          .getByTestId('editorialEngagementRow')
          .findByProps({testID: 'testSource'}),
      ).toBeTruthy()
    }
  },
)
it('opens text and photo previews in the thread without nesting an interactive gallery', () => {
  const story = article({
    $type: 'app.bsky.embed.images#view',
    images: [
      {
        thumb: 'https://example.com/thumb.jpg',
        fullsize: 'https://example.com/full.jpg',
        alt: 'Real photo',
      },
    ],
  })
  render(<Article article={story} linkTo="post" />)
  expect(screen.getByTestId('editorialPostLink').props.to).toBe(
    '/profile/test.example/post/one',
  )
  expect(screen.getByTestId('editorialMediaLink').props.to).toBe(
    '/profile/test.example/post/one',
  )
  expect(ImageEmbed).not.toHaveBeenCalled()
  expect(jest.mocked(RichText).mock.calls[0][0]).toMatchObject({
    disableLinks: true,
    enableTags: false,
  })
})
it('opens a text-only reader post in its original thread', () => {
  render(<Article article={article()} linkTo="post" />)
  expect(screen.getByTestId('editorialPostLink').props.to).toBe(
    '/profile/test.example/post/one',
  )
})
it('opens a video caption in its thread without wrapping playback controls in a link', () => {
  const story = article({
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://example.com/video.m3u8',
    thumbnail: 'https://example.com/video.jpg',
  })
  render(<Article article={story} linkTo="post" />)
  expect(screen.getByTestId('editorialPostLink').props.to).toBe(
    '/profile/test.example/post/one',
  )
  expectOutsideLink(VideoEmbed)
})
it('shows four description lines on compact wide news stories, covering companions and equal pairs', () => {
  const original = PRODUCT.id
  jest.replaceProperty(PRODUCT, 'id', 'news')
  try {
    const story = article({
      $type: 'app.bsky.embed.external#view',
      external: {
        uri: 'https://example.com/story',
        title: 'Source headline',
        description: 'The genuine source description',
      },
    })
    const view = render(<Article article={story} size="small" compact wide />)
    expect(
      screen.getByText('The genuine source description').props.numberOfLines,
    ).toBe(4)
    const headlineStyle = screen.getByTestId('articleHeadline').props.style
    expect(headlineStyle).toContainEqual(
      expect.objectContaining({fontWeight: '600'}),
    )
    expect(headlineStyle).not.toContainEqual(
      expect.objectContaining({fontFamily: expect.anything()}),
    )
    view.rerender(<Article article={story} size="small" compact />)
    expect(screen.queryByText('The genuine source description')).toBeNull()
  } finally {
    jest.replaceProperty(PRODUCT, 'id', original)
  }
})
it('does not repeat the publisher caption when it matches the summary', () => {
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://example.com/story',
      title: 'A real headline',
      description: 'The publisher’s summary.',
    },
  })
  story.item.record.text = 'The publisher’s summary.'
  render(<Article article={story} presentation="thread" lead />)
  expect(screen.getAllByText('The publisher’s summary.')).toHaveLength(1)
  expect(screen.queryByTestId('editorialPostText')).toBeNull()
})

it('renders missing link-preview metadata as post text, not an oversized headline', () => {
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://www.theverge.com/tech/1028412/airbnb',
      title: '',
      description: '',
    },
  })
  story.item.record.text =
    'A travel company is planning an AI-native trip. www.theverge.com/tech/1028412...'
  render(<Article article={story} lead wide size="medium" />)
  expect(screen.getByTestId('editorialPostText')).toBeTruthy()
  expect(screen.getByTestId('articleHeadline').props.children).toBe(
    'theverge.com',
  )
  expect(
    screen.getByTestId('articleHeadline').props.accessibilityRole,
  ).toBeUndefined()
  expect(screen.getByTestId('articleHeadline').props.style).toContainEqual(
    expect.objectContaining({fontSize: 14}),
  )
  expect(screen.getByTestId('editorialStoryLink').props.to).toBe(story.url)
})

it('constrains long real headlines to their column and allows URL-sized tokens to wrap', () => {
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://example.com/story',
      title: 'A real headline withaverylongunbrokentoken'.repeat(10),
      description: '',
    },
  })
  render(<Article article={story} lead wide />)
  expect(screen.getByTestId('articleHeadline').props.style).toContainEqual({
    overflowWrap: 'anywhere',
  })
  expect(screen.getByTestId('articleHeadline').props.accessibilityRole).toBe(
    'header',
  )
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

it('uses an interactive like control while keeping the repost people-list link', () => {
  const story = article()
  story.item.post.likeCount = 11
  story.item.post.repostCount = 4
  render(<Article article={story} />)
  expect(jest.mocked(ArticleLikeButton).mock.calls[0][0].post).toBe(
    story.item.post,
  )
  expect(screen.getByTestId('editorialLikes').props.to).toBeUndefined()
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
  expect(props.style).toContainEqual(
    expect.objectContaining({fontSize: 20, lineHeight: 30}),
  )
  expect(props.style).not.toContainEqual(
    expect.objectContaining({color: expect.anything()}),
  )
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

it('places publisher attribution inside the engagement row, outside the story link', () => {
  render(
    <Article
      article={article()}
      byline={<Text testID="sourceBadge">WIRED</Text>}
    />,
  )
  expect(
    screen
      .getByTestId('editorialPostStats')
      .findByProps({testID: 'sourceBadge'}),
  ).toBeTruthy()
  let parent = screen.getByTestId('sourceBadge').parent
  while (parent) {
    expect(parent.type).not.toBe(Link)
    parent = parent.parent
  }
})

it('caps compact Home feature headlines without changing Publisher features', () => {
  const story = article({
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://example.com/story',
      title: 'A real headline',
      description: '',
    },
  })
  const {rerender} = render(<Article article={story} lead wide dense />)
  expect(screen.getByTestId('articleHeadline').props.style).toContainEqual(
    expect.objectContaining({fontSize: PRODUCT.id === 'news' ? 48 : 30}),
  )
  rerender(<Article article={story} lead wide />)
  expect(screen.getByTestId('articleHeadline').props.style).toContainEqual(
    expect.objectContaining({fontSize: PRODUCT.id === 'news' ? 56 : 40}),
  )
})

it('places a large video beside the story and caps its height at 80 percent of the window', () => {
  const story = article({
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://video.example/video.m3u8',
    aspectRatio: {width: 9, height: 16},
  })
  render(<Article article={story} size="big" wide />)
  expect(screen.getByTestId('articleFeatureVideo').props.style).toContainEqual(
    expect.objectContaining({
      width: '48%',
      maxHeight: Dimensions.get('window').height * 0.8,
    }),
  )
  expect(jest.mocked(VideoEmbed).mock.calls[0][0].immersive).toBe(true)
  expectOutsideLink(VideoEmbed)
})

it('stacks and caps large videos on narrow screens without changing carousel cards', () => {
  const story = article({
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://video.example/video.m3u8',
  })
  jest.mocked(useBreakpoints).mockReturnValueOnce({
    gtMobile: false,
    gtPhone: false,
    gtTablet: false,
    activeBreakpoint: undefined,
  })
  const {rerender} = render(<Article article={story} size="big" />)
  expect(screen.queryByTestId('articleFeatureVideo')).toBeNull()
  expect(screen.getByTestId('articleCappedVideo').props.style).toContainEqual(
    expect.objectContaining({
      width: '100%',
      maxHeight: Dimensions.get('window').height * 0.8,
    }),
  )
  rerender(<Article article={story} size="big" card />)
  expect(screen.queryByTestId('articleFeatureVideo')).toBeNull()
  expect(screen.queryByTestId('articleCappedVideo')).toBeNull()
})

it('does not render media for deleted posts', () => {
  jest.mocked(usePostShadow).mockReturnValueOnce(POST_TOMBSTONE)
  render(<Article article={article()} />)
  expect(screen.toJSON()).toBeNull()
  expect(ImageEmbed).not.toHaveBeenCalled()
  expect(VideoEmbed).not.toHaveBeenCalled()
})
