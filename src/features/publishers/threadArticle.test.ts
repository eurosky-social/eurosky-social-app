import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {getProduct} from '#/config/product'
import {PUBLISHERS} from './publishers'
import {publisherThreadArticle} from './threadArticle'

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
