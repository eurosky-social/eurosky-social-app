import {StyleSheet} from 'react-native'
import {render, screen} from '@testing-library/react-native'

import {articleFromPost} from '#/features/articles/articles'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {NewsCard} from './index'

jest.mock('@lingui/react', () => {
  const interpolate = ({
    message,
    values,
  }: {
    message: string
    values?: Record<string, string>
  }) => message.replace(/\{(\w+)\}/g, (_, key: string) => values?.[key] ?? '')
  return {
    useLingui: () => ({
      _: interpolate,
      i18n: {_: interpolate, date: () => '11 Nov'},
    }),
  }
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
jest.mock('expo-image', () => ({
  Image: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Button', () => ({
  Button: (require('react-native') as typeof import('react-native')).Pressable,
  ButtonText: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/ProfileCard', () => ({Avatar: () => null}))
jest.mock('#/components/moderation/ContentHider', () => ({
  ContentHider: ({
    children,
    style,
  }: React.PropsWithChildren<{
    style?: import('react-native').StyleProp<import('react-native').ViewStyle>
  }>) => {
    const {View} = require('react-native') as typeof import('react-native')
    return (
      <View testID="newsCardHider" style={style}>
        {children}
      </View>
    )
  },
}))
jest.mock('#/components/icons/Play', () => ({
  Play_Filled_Corner2_Rounded: () => null,
}))
jest.mock('#/components/icons/Image', () => ({
  Image_Stroke2_Corner2_Rounded: () => null,
}))
jest.mock('#/lib/moderation/useModerationCauseDescription', () => ({
  useModerationCauseDescription: () => ({name: 'Graphic media'}),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))
jest.mock('#/state/cache/post-shadow', () => ({
  POST_TOMBSTONE: Symbol('deleted'),
  usePostShadow: (post: unknown) => post,
}))
jest.mock('#/features/articles/moderation', () => ({
  articleModeration: () => mockModeration,
}))
jest.mock('./CardActions', () => ({
  CardActions: () => null,
  useCardTime: () => ({label: '2m ago', full: '11 Nov 2026, 09:58'}),
}))

jest.mock('#/state/preferences', () => ({
  useAutoplayDisabled: () => mockAutoplayDisabled,
}))
jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => mockReducedMotion,
}))
jest.mock('#/components/Post/Embed/VideoEmbed', () => {
  const {View} = require('react-native') as typeof import('react-native')
  return {VideoEmbed: () => <View testID="newsCardVideo" />}
})

let mockPostTextUi: {blur: boolean; blurs: unknown[]} = {
  blur: false,
  blurs: [],
}
let mockAutoplayDisabled = false
let mockReducedMotion = false
let mockModeration: {filter: boolean; blur: boolean; blurs: unknown[]} = {
  filter: false,
  blur: false,
  blurs: [],
}

const publisher = PUBLISHERS[0]
type Embed = Parameters<typeof articleFromPost>[0]['post']['embed']

function story(
  embed?: Embed,
  {
    text = 'A post headline\nThe rest of the post.',
    tags = ['energy'],
  }: {text?: string; tags?: string[]} = {},
) {
  return articleFromPost({
    _reactKey: 'one',
    uri: `at://${publisher.did}/app.bsky.feed.post/abc`,
    post: {
      uri: `at://${publisher.did}/app.bsky.feed.post/abc`,
      cid: 'bafy',
      author: {did: publisher.did, handle: publisher.domain},
      record: {},
      indexedAt: '2026-11-11T09:58:00Z',
      replyCount: 48,
      repostCount: 112,
      likeCount: 640,
      embed,
    },
    record: {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: '2026-11-11T09:58:00Z',
      facets: tags.map(tag => ({
        index: {byteStart: 0, byteEnd: 1},
        features: [{$type: 'app.bsky.richtext.facet#tag' as const, tag}],
      })),
    },
    moderation: {
      ui: () => mockPostTextUi,
    } as unknown as Parameters<typeof articleFromPost>[0]['moderation'],
  })
}

const article = story({
  $type: 'app.bsky.embed.external#view',
  external: {
    uri: 'https://example.com/story',
    title: 'Baltic grid operators finish their first winter',
    description: 'A real standfirst.',
    thumb: 'https://example.com/thumb.jpg',
  },
})
const youtube = story({
  $type: 'app.bsky.embed.external#view',
  external: {
    uri: 'https://www.youtube.com/watch?v=abcdefghijk',
    title: 'A video',
    description: '',
    thumb: 'https://example.com/thumb.jpg',
  },
})
const gallery = story({
  $type: 'app.bsky.embed.images#view',
  images: Array.from({length: 4}, (_, i) => ({
    thumb: `https://example.com/${i}.jpg`,
    fullsize: `https://example.com/${i}.jpg`,
    alt: '',
  })),
})
const quote = story({
  $type: 'app.bsky.embed.record#view',
  record: {
    $type: 'app.bsky.embed.record#viewRecord',
    uri: 'at://did:plc:other/app.bsky.feed.post/two',
    cid: 'bafyquote',
    author: {did: 'did:plc:other', handle: 'other.example'},
    value: {
      $type: 'app.bsky.feed.post',
      text: 'EU budget talks stall.',
      createdAt: '',
    },
    indexedAt: '2026-11-11T08:00:00Z',
  },
})
const text = story(undefined, {text: 'A plain text post'})

const hidden = {includeHiddenElements: true}
function headlineStyle() {
  return Object.assign(
    {},
    ...[screen.getByTestId('newsCardHeadline', hidden).props.style]
      .flat(Infinity)
      .filter(Boolean),
  ) as Record<string, unknown>
}

beforeEach(() => {
  mockModeration = {filter: false, blur: false, blurs: []}
  mockPostTextUi = {blur: false, blurs: []}
  mockAutoplayDisabled = false
  mockReducedMotion = false
})

it('shows the publisher and the hashtag topic in the kicker', () => {
  render(<NewsCard article={article} size="standard" />)
  expect(screen.getByTestId('newsCardPublisher').props.to).toEqual({
    screen: 'Publisher',
    params: {publisher: publisher.id},
  })
  expect(screen.getByTestId('newsCardTopic', hidden)).toHaveTextContent(
    'Energy',
  )
})

it('omits the topic when the post has no hashtag', () => {
  render(<NewsCard article={story(undefined, {tags: []})} size="standard" />)
  expect(screen.queryByTestId('newsCardTopic', hidden)).toBeNull()
})

it('links the whole card to the post with a full accessible name', () => {
  render(<NewsCard article={article} size="standard" />)
  const link = screen.getByTestId('newsCardLink')
  expect(link.props.to).toBe(`/profile/${publisher.domain}/post/abc`)
  expect(link.props.label).toContain(publisher.name)
  expect(link.props.label).toContain('Energy')
  expect(link.props.label).toContain(
    'Baltic grid operators finish their first winter.',
  )
  expect(link.props.label).toContain('2m ago')
})

it.each([
  ['lead', 44, '700'],
  ['feature', 32, '600'],
  ['standard', 24, '600'],
  ['compact', 17, '600'],
] as const)('sets %s headlines at %ipx', (size, fontSize, fontWeight) => {
  render(<NewsCard article={article} size={size} />)
  expect(headlineStyle()).toMatchObject({fontSize, fontWeight})
})

it('sets a text post one step down', () => {
  render(<NewsCard article={text} size="standard" />)
  expect(headlineStyle()).toMatchObject({fontSize: 18})
})

it('limits the standfirst to 3 lines on Lead, 2 on Feature, none below', () => {
  const {rerender} = render(<NewsCard article={article} size="lead" />)
  expect(
    screen.getByTestId('newsCardStandfirst', hidden).props.numberOfLines,
  ).toBe(3)
  rerender(<NewsCard article={article} size="feature" />)
  expect(
    screen.getByTestId('newsCardStandfirst', hidden).props.numberOfLines,
  ).toBe(2)
  rerender(<NewsCard article={article} size="standard" />)
  expect(screen.queryByTestId('newsCardStandfirst', hidden)).toBeNull()
  rerender(<NewsCard article={article} size="compact" />)
  expect(screen.queryByTestId('newsCardStandfirst', hidden)).toBeNull()
})

it('uses 16:9 and a Video badge for YouTube, and a count for galleries', () => {
  const {rerender} = render(<NewsCard article={youtube} size="standard" />)
  expect(screen.getByTestId('newsCardMedia', hidden).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({aspectRatio: 16 / 9})]),
  )
  expect(screen.getByTestId('newsCardBadge', hidden)).toHaveTextContent('Video')
  expect(screen.getByTestId('newsCardKicker', hidden)).toHaveTextContent(
    /YouTube/,
  )
  rerender(<NewsCard article={gallery} size="standard" />)
  expect(screen.getByTestId('newsCardBadge', hidden)).toHaveTextContent('1/4')
})

it('crops compact thumbnails to 4:3', () => {
  render(<NewsCard article={article} size="compact" />)
  expect(screen.getByTestId('newsCardMedia', hidden).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({aspectRatio: 4 / 3})]),
  )
})

it('renders no media for text posts and title-only links', () => {
  const link = story({
    $type: 'app.bsky.embed.external#view',
    external: {uri: 'https://example.com/x', title: 'A link', description: ''},
  })
  for (const size of ['standard', 'compact'] as const) {
    const view = render(<NewsCard article={text} size={size} />)
    expect(screen.queryByTestId('newsCardMedia', hidden)).toBeNull()
    view.rerender(<NewsCard article={link} size={size} />)
    expect(screen.queryByTestId('newsCardMedia', hidden)).toBeNull()
    view.unmount()
  }
})

it('shows one attribution line for a quote post', () => {
  render(<NewsCard article={quote} size="standard" />)
  expect(screen.getByTestId('newsCardQuoteLine', hidden)).toHaveTextContent(
    /Quoting @other\.example/,
  )
})

it('blurs media under a warning but keeps the headline', () => {
  mockModeration = {filter: false, blur: true, blurs: [{type: 'label'}]}
  render(<NewsCard article={article} size="standard" />)
  expect(screen.getByTestId('newsCardMediaBlurred', hidden)).toBeTruthy()
  expect(screen.getByTestId('newsCardHeadline', hidden)).toBeTruthy()
})

it('renders nothing for filtered stories', () => {
  mockModeration = {filter: true, blur: false, blurs: []}
  render(<NewsCard article={article} size="standard" />)
  expect(screen.queryByTestId('newsCard', hidden)).toBeNull()
})

it('lets very long words wrap inside the column', () => {
  render(
    <NewsCard
      article={story(undefined, {text: 'x'.repeat(400)})}
      size="standard"
    />,
  )
  expect(headlineStyle()).toMatchObject({overflowWrap: 'anywhere'})
})

describe('Lead video', () => {
  const video = story({
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://example.com/playlist.m3u8',
    thumbnail: 'https://example.com/video.jpg',
  })

  it('autoplays in the Lead slot', () => {
    render(<NewsCard article={video} size="lead" />)
    expect(screen.getByTestId('newsCardVideo', hidden)).toBeTruthy()
  })

  it('shows a still with a play badge outside the Lead slot', () => {
    render(<NewsCard article={video} size="feature" />)
    expect(screen.queryByTestId('newsCardVideo', hidden)).toBeNull()
    expect(screen.getByTestId('newsCardBadge', hidden)).toHaveTextContent(
      'Video',
    )
  })

  it('respects the autoplay preference and reduced motion', () => {
    mockAutoplayDisabled = true
    const view = render(<NewsCard article={video} size="lead" />)
    expect(screen.queryByTestId('newsCardVideo', hidden)).toBeNull()
    view.unmount()
    mockAutoplayDisabled = false
    mockReducedMotion = true
    render(<NewsCard article={video} size="lead" />)
    expect(screen.queryByTestId('newsCardVideo', hidden)).toBeNull()
  })
})

describe('review fixes', () => {
  it('shows no media and no headline in the link name when the text is warned', () => {
    mockPostTextUi = {blur: true, blurs: [{type: 'label'}]}
    mockModeration = {filter: false, blur: true, blurs: [{type: 'label'}]}
    render(<NewsCard article={article} size="lead" />)
    expect(screen.queryByTestId('newsCardMedia', hidden)).toBeNull()
    const label = screen.getByTestId('newsCardLink').props.label as string
    expect(label).toContain('Graphic media')
    expect(label).not.toContain('Baltic grid operators')
  })

  it('lets taps pass through the warning wrapper to the card link', () => {
    mockPostTextUi = {blur: true, blurs: [{type: 'label'}]}
    render(<NewsCard article={article} size="standard" />)
    expect(
      StyleSheet.flatten(
        screen.getByTestId('newsCardHider', hidden).props.style,
      ),
    ).toMatchObject({pointerEvents: 'box-none'})
  })

  it('hides the visible story and media from assistive technology on web too', () => {
    render(<NewsCard article={youtube} size="standard" />)
    expect(
      screen.getByTestId('newsCardStory', hidden).props['aria-hidden'],
    ).toBe(true)
    expect(
      screen.getByTestId('newsCardMedia', hidden).props['aria-hidden'],
    ).toBe(true)
    expect(
      screen.getByTestId('newsCardTopicGroup', hidden).props['aria-hidden'],
    ).toBe(true)
  })

  it('never lets the media frame catch taps', () => {
    mockModeration = {filter: false, blur: true, blurs: [{type: 'label'}]}
    render(<NewsCard article={article} size="standard" />)
    expect(
      screen.getByTestId('newsCardMedia', hidden).props.pointerEvents,
    ).toBe('none')
  })
})
