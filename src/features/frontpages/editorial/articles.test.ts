import {describe, expect, it} from '@jest/globals'

import {
  type FeedPostSlice,
  type FeedPostSliceItem,
} from '#/state/queries/post-feed'
import {type app} from '#/lexicons'
import {findPublicationPreview} from '../preview'
import {articleFromPost, editorialArticles} from './articles'

const DID = 'did:plc:y57igqldvutzs7gpmmrrqbw7'

function item(
  id: string,
  embed?: app.bsky.feed.defs.PostView['embed'],
): FeedPostSliceItem {
  return {
    _reactKey: id,
    uri: `at://${DID}/app.bsky.feed.post/${id}`,
    post: {
      uri: `at://${DID}/app.bsky.feed.post/${id}`,
      cid: 'bafytest',
      author: {did: DID, handle: 'test1234321.eurosky.social'},
      record: {},
      indexedAt: '2026-10-28T12:00:00Z',
      embed,
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'A headline\n\nThe rest of the post.',
      createdAt: '2026-10-28T12:00:00Z',
    },
    moderation: {} as FeedPostSliceItem['moderation'],
  }
}

function slice(
  items: FeedPostSliceItem[],
  reason?: FeedPostSlice['reason'],
): FeedPostSlice {
  return {
    _isFeedPostSlice: true,
    _reactKey: items[0].uri,
    items,
    reason,
    isIncompleteThread: false,
    isFallbackMarker: false,
    feedContext: undefined,
    reqId: undefined,
    feedPostUri: items[0].uri,
  }
}

function external(
  url: `https://${string}` = 'https://www.wired.com/story/example/',
): app.bsky.embed.external.View & {$type: 'app.bsky.embed.external#view'} {
  return {
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: url,
      title: 'The actual article headline',
      description: 'The article summary.',
      thumb: 'https://cdn.example/image.jpg',
    },
  }
}

describe('publication preview', () => {
  it('only resolves the explicit demo and never turns arbitrary profiles into publications', () => {
    expect(findPublicationPreview(DID)?.slug).toBe('editorial-test')
    expect(findPublicationPreview('editorial-test')?.did).toBe(DID)
    expect(findPublicationPreview('test1234321.eurosky.social')?.did).toBe(DID)
    expect(findPublicationPreview('did:plc:someoneelse')).toBeUndefined()
    expect(findPublicationPreview('toString')).toBeUndefined()
    expect(findPublicationPreview(undefined)).toBeUndefined()
  })
})

describe('articleFromPost', () => {
  it('uses the link preview headline, description and image', () => {
    expect(articleFromPost(item('one', external()))).toMatchObject({
      title: 'The actual article headline',
      description: 'The article summary.',
      image: 'https://cdn.example/image.jpg',
      url: 'https://www.wired.com/story/example/',
    })
  })

  it('handles text-only posts without inventing an image or article URL', () => {
    expect(articleFromPost(item('one'))).toMatchObject({
      title: 'A headline',
      description: 'The rest of the post.',
      image: undefined,
      url: undefined,
    })
  })

  it('uses native photo posts and preserves their alt text', () => {
    const post = item('one', {
      $type: 'app.bsky.embed.images#view',
      images: [
        {
          thumb: 'https://cdn.example/small.jpg',
          fullsize: 'https://cdn.example/full.jpg',
          alt: 'A real image description',
        },
      ],
    })
    expect(articleFromPost(post)).toMatchObject({
      image: 'https://cdn.example/full.jpg',
      imageAlt: 'A real image description',
      media: {type: 'images', view: post.post.embed},
    })
  })

  it('keeps every carousel image, its alt text and aspect ratio', () => {
    const images = Array.from(
      {length: 4},
      (_, index): app.bsky.embed.images.ViewImage => ({
        thumb: `https://cdn.example/${index}-small.jpg`,
        fullsize: `https://cdn.example/${index}.jpg`,
        alt: `Photo ${index + 1}`,
        aspectRatio: {width: 1200, height: 800},
      }),
    )
    const article = articleFromPost(
      item('carousel', {$type: 'app.bsky.embed.images#view', images}),
    )
    expect(article.media).toEqual({
      type: 'images',
      view: {$type: 'app.bsky.embed.images#view', images},
    })
    expect(article.url).toBeUndefined()
  })

  it('keeps gallery embeds instead of dropping their images', () => {
    const gallery: app.bsky.feed.defs.PostView['embed'] = {
      $type: 'app.bsky.embed.gallery#view',
      items: [
        {
          $type: 'app.bsky.embed.gallery#viewImage',
          thumbnail: 'https://cdn.example/small.jpg',
          fullsize: 'https://cdn.example/full.jpg',
          alt: 'Gallery photo',
          aspectRatio: {width: 1200, height: 800},
        },
        {
          $type: 'app.bsky.embed.gallery#viewImage',
          thumbnail: 'https://cdn.example/small-2.jpg',
          fullsize: 'https://cdn.example/full-2.jpg',
          alt: 'Second gallery photo',
          aspectRatio: {width: 800, height: 1200},
        },
      ],
    }
    expect(articleFromPost(item('gallery', gallery))).toMatchObject({
      image: 'https://cdn.example/full.jpg',
      imageAlt: 'Gallery photo',
      media: {type: 'gallery', view: gallery},
    })
  })

  it('preserves playable video metadata and its preview', () => {
    const video: app.bsky.embed.video.View & {
      $type: 'app.bsky.embed.video#view'
    } = {
      $type: 'app.bsky.embed.video#view',
      cid: 'bafyvideo',
      playlist: 'https://video.example/playlist.m3u8',
      thumbnail: 'https://video.example/thumbnail.jpg',
      alt: 'A video description',
      aspectRatio: {width: 1920, height: 1080},
    }
    expect(articleFromPost(item('video', video))).toMatchObject({
      image: video.thumbnail,
      imageAlt: video.alt,
      media: {type: 'video', view: video},
      url: undefined,
    })
  })

  it('keeps playable media attached to quote posts', () => {
    const media: app.bsky.embed.video.View & {
      $type: 'app.bsky.embed.video#view'
    } = {
      $type: 'app.bsky.embed.video#view',
      cid: 'bafyvideo',
      playlist: 'https://video.example/playlist.m3u8',
    }
    const article = articleFromPost(
      item('video-quote', {
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {
          $type: 'app.bsky.embed.record#view',
          record: {
            $type: 'app.bsky.embed.record#viewNotFound',
            uri: `at://${DID}/app.bsky.feed.post/missing`,
            notFound: true,
          },
        },
        media,
      }),
    )
    expect(article.media).toEqual({type: 'video', view: media})
  })

  it('unwraps link previews attached to a quote post', () => {
    const link = external()
    const article = articleFromPost(
      item('quote', {
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {
          $type: 'app.bsky.embed.record#view',
          record: {
            $type: 'app.bsky.embed.record#viewNotFound',
            uri: `at://${DID}/app.bsky.feed.post/missing`,
            notFound: true,
          },
        },
        media: link,
      }),
    )
    expect(article.title).toBe('The actual article headline')
    expect(article.media).toBeUndefined()
  })
})

describe('editorialArticles', () => {
  it('preserves feed order and removes duplicate posts and duplicate article links', () => {
    const one = item('one', external())
    const two = item('two', external())
    const three = item('three', external('https://www.wired.com/story/other/'))
    expect(
      editorialArticles([slice([one, two, three]), slice([one])], DID).map(
        article => article.item.uri,
      ),
    ).toEqual([one.uri, three.uri])
  })

  it('excludes replies, reposts and posts by other accounts', () => {
    const reply = item('reply')
    reply.record.reply = {
      root: {uri: reply.uri, cid: 'bafytest'},
      parent: {uri: reply.uri, cid: 'bafytest'},
    }
    const other = item('other')
    other.post.author.did = 'did:plc:someoneelse'
    const repost = slice([item('repost')], {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: {did: DID, handle: 'test1234321.eurosky.social'},
      indexedAt: '2026-10-28T12:00:00Z',
    })
    const own = item('own')
    expect(
      editorialArticles([slice([reply, other, own]), repost], DID).map(
        article => article.item.uri,
      ),
    ).toEqual([own.uri])
  })
})
