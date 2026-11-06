import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {getProduct} from '#/config/product'
import {PUBLISHERS} from './publishers'
import {publisherFeedArticle, publisherThreadArticle} from './threadArticle'

function feedItem(source = item()) {
  return {
    _reactKey: source.key,
    uri: source.value.post.uri,
    post: source.value.post,
    record: source.value.post.record,
    moderation: source.moderation,
  }
}

function item(did: string = PUBLISHERS[0].did, reply = false) {
  return {
    type: 'threadPost',
    key: 'one',
    depth: 0,
    value: {
      post: {
        uri: 'at://did:plc:publisher/app.bsky.feed.post/one',
        cid: 'bafytest',
        author: {did, handle: 'publisher.test'},
        record: {
          text: 'Publisher post',
          createdAt: '2026-01-01T00:00:00Z',
          ...(reply ? {reply: {}} : {}),
        },
      },
    },
    moderation: {ui: () => ({})},
  } as unknown as Extract<ThreadItem, {type: 'threadPost'}>
}
it.each(PUBLISHERS)(
  'uses article presentation for $name original anchors in news',
  publisher => {
    const source = item(publisher.did)
    expect(publisherThreadArticle(source, getProduct('news'))?.item.post).toBe(
      source.value.post,
    )
  },
)
it('keeps the original publisher article when it becomes an ancestor after opening a reply', () => {
  expect(
    publisherThreadArticle({...item(), depth: -2}, getProduct('news')),
  ).toBeDefined()
})
it.each(PUBLISHERS)(
  'renders $name originals above profile replies as articles with their original identity',
  publisher => {
    const source = feedItem(item(publisher.did))
    expect(
      publisherFeedArticle(
        source,
        'publisher-replies|did:plc:reader',
        getProduct('news'),
      )?.item,
    ).toBe(source)
  },
)
it.each([
  undefined,
  'author|did:plc:reader',
  'publishers|articles',
  'publisher-replies-other|did:plc:reader',
])('leaves unrelated feed %s untouched', descriptor => {
  expect(
    publisherFeedArticle(feedItem(), descriptor, getProduct('news')),
  ).toBeUndefined()
})
it('preserves social profile feeds and ordinary comments, even publisher-authored replies', () => {
  const descriptor = 'publisher-replies|did:plc:reader'
  expect(
    publisherFeedArticle(feedItem(), descriptor, getProduct('social')),
  ).toBeUndefined()
  expect(
    publisherFeedArticle(
      feedItem(item('did:plc:reader')),
      descriptor,
      getProduct('news'),
    ),
  ).toBeUndefined()
  expect(
    publisherFeedArticle(
      feedItem(item(PUBLISHERS[0].did, true)),
      descriptor,
      getProduct('news'),
    ),
  ).toBeUndefined()
})
it('preserves social, non-publisher posts and replies', () => {
  expect(publisherThreadArticle(item(), getProduct('social'))).toBeUndefined()
  expect(
    publisherThreadArticle(item('did:plc:reader'), getProduct('news')),
  ).toBeUndefined()
  expect(
    publisherThreadArticle(item(PUBLISHERS[0].did, true), getProduct('news')),
  ).toBeUndefined()
  expect(
    publisherThreadArticle({...item(), depth: 1}, getProduct('news')),
  ).toBeUndefined()
})
