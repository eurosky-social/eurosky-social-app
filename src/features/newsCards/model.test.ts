import {articleFromPost} from '#/features/articles/articles'
import {
  cardAccessibleName,
  cardHasMedia,
  cardKind,
  cardTimeBucket,
  cardTopic,
} from './model'

type Embed = Parameters<typeof articleFromPost>[0]['post']['embed']

function story(embed?: Embed, text = 'A headline\nThe rest of the post.') {
  return articleFromPost({
    _reactKey: 'one',
    uri: 'at://did:plc:test/app.bsky.feed.post/one',
    post: {
      uri: 'at://did:plc:test/app.bsky.feed.post/one',
      cid: 'bafytest',
      author: {did: 'did:plc:test', handle: 'test.example'},
      record: {},
      indexedAt: '2026-11-11T09:00:00Z',
      embed,
    },
    record: {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: '2026-11-11T09:00:00Z',
    },
    moderation: {
      ui: () => ({}),
    } as unknown as Parameters<typeof articleFromPost>[0]['moderation'],
  })
}

function external(uri: string, title: string, thumb?: string): Embed {
  return {
    $type: 'app.bsky.embed.external#view',
    external: {uri, title, description: 'A description', thumb},
  } as Embed
}

function images(count: number): Embed {
  return {
    $type: 'app.bsky.embed.images#view',
    images: Array.from({length: count}, (_, index) => ({
      thumb: `https://example.com/thumb-${index}.jpg`,
      fullsize: `https://example.com/full-${index}.jpg`,
      alt: '',
    })),
  }
}

function video(presentation?: 'gif'): Embed {
  return {
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://example.com/playlist.m3u8',
    thumbnail: 'https://example.com/video.jpg',
    presentation,
  }
}

const quoteRecord = {
  $type: 'app.bsky.embed.record#view',
  record: {
    $type: 'app.bsky.embed.record#viewRecord',
    uri: 'at://did:plc:other/app.bsky.feed.post/two',
    cid: 'bafyquote',
    author: {did: 'did:plc:other', handle: 'other.example'},
    value: {$type: 'app.bsky.feed.post', text: 'Quoted', createdAt: ''},
    indexedAt: '2026-11-11T08:00:00Z',
  },
}

describe('cardKind', () => {
  it('classifies a titled link with a thumbnail as an article', () => {
    expect(
      cardKind(
        story(
          external('https://example.com/a', 'Title', 'https://e.com/t.jpg'),
        ),
      ),
    ).toBe('article')
  })
  it('classifies a titled link without a thumbnail as a link', () => {
    expect(cardKind(story(external('https://example.com/a', 'Title')))).toBe(
      'link',
    )
  })
  it('treats a whitespace-only link title with a thumbnail as a text post', () => {
    expect(
      cardKind(
        story(external('https://example.com/a', '   ', 'https://e.com/t.jpg')),
      ),
    ).toBe('text')
  })
  it('classifies a post with no embed as a text post', () => {
    expect(cardKind(story())).toBe('text')
  })
  it('classifies one image as image and several as gallery', () => {
    expect(cardKind(story(images(1)))).toBe('image')
    expect(cardKind(story(images(3)))).toBe('gallery')
  })
  it('classifies native video, and treats GIF video as an image', () => {
    expect(cardKind(story(video()))).toBe('video')
    expect(cardKind(story(video('gif')))).toBe('image')
  })
  it('classifies a YouTube link as youtube', () => {
    expect(
      cardKind(
        story(
          external(
            'https://www.youtube.com/watch?v=abcdefghijk',
            'A video',
            'https://e.com/t.jpg',
          ),
        ),
      ),
    ).toBe('youtube')
  })
  it('classifies a record embed as a quote', () => {
    expect(cardKind(story(quoteRecord as Embed))).toBe('quote')
  })
})

describe('cardHasMedia', () => {
  it('is true for kinds with pictures or video', () => {
    expect(
      cardHasMedia(
        story(external('https://example.com/a', 'T', 'https://e.com/t.jpg')),
      ),
    ).toBe(true)
    expect(cardHasMedia(story(images(1)))).toBe(true)
    expect(cardHasMedia(story(images(4)))).toBe(true)
    expect(cardHasMedia(story(video()))).toBe(true)
  })
  it('is false for title-only links and text posts', () => {
    expect(cardHasMedia(story(external('https://example.com/a', 'T')))).toBe(
      false,
    )
    expect(cardHasMedia(story())).toBe(false)
  })
  it('is true for a quote only when the post has its own media', () => {
    expect(cardHasMedia(story(quoteRecord as Embed))).toBe(false)
    expect(
      cardHasMedia(
        story({
          $type: 'app.bsky.embed.recordWithMedia#view',
          record: quoteRecord,
          media: images(1),
        } as Embed),
      ),
    ).toBe(true)
  })
})

describe('cardTopic', () => {
  const tag = (value: string) => ({
    index: {byteStart: 0, byteEnd: value.length + 1},
    features: [{$type: 'app.bsky.richtext.facet#tag' as const, tag: value}],
  })
  it('title-cases the first hashtag', () => {
    expect(cardTopic({facets: [tag('ukraine'), tag('eu')]})).toBe('Ukraine')
    expect(cardTopic({facets: [tag('climate-crisis')]})).toBe('Climate-crisis')
  })
  it('is undefined without hashtags', () => {
    expect(cardTopic({})).toBeUndefined()
    expect(
      cardTopic({
        facets: [
          {
            index: {byteStart: 0, byteEnd: 4},
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'https://example.com',
              },
            ],
          },
        ],
      }),
    ).toBeUndefined()
  })
})

describe('cardTimeBucket', () => {
  const now = new Date(2026, 10, 11, 10, 0, 0)
  const ago = (ms: number) => new Date(now.getTime() - ms)
  const MIN = 60_000
  const HOUR = 60 * MIN
  it('buckets by age', () => {
    expect(cardTimeBucket(ago(30_000), now)).toEqual({kind: 'now'})
    expect(cardTimeBucket(ago(2 * HOUR), now)).toEqual({kind: 'relative'})
    expect(cardTimeBucket(ago(24 * HOUR - MIN), now)).toEqual({
      kind: 'relative',
    })
    expect(cardTimeBucket(ago(30 * HOUR), now)).toEqual({kind: 'yesterday'})
    expect(cardTimeBucket(ago(5 * 24 * HOUR), now)).toEqual({kind: 'date'})
  })
})

describe('cardAccessibleName', () => {
  const counts = {
    time: '2m ago',
    comments: '48 comments',
    reposts: '112 reposts',
    likes: '640 likes',
  }
  it('joins kicker, headline, time and counts', () => {
    expect(
      cardAccessibleName({
        publisher: 'Harbour Wire',
        topic: 'Energy',
        format: 'YouTube',
        headline: 'Headline',
        ...counts,
      }),
    ).toBe(
      'Harbour Wire, Energy, YouTube. Headline. 2m ago. 48 comments, 112 reposts, 640 likes.',
    )
  })
  it('omits a missing topic and format', () => {
    expect(
      cardAccessibleName({
        publisher: 'Harbour Wire',
        headline: 'Headline',
        ...counts,
      }),
    ).toBe(
      'Harbour Wire. Headline. 2m ago. 48 comments, 112 reposts, 640 likes.',
    )
  })
})
