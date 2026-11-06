import {getProduct} from '#/config/product'
import {canBookmarkPost, canBookmarkUri} from '#/features/product/bookmarking'
import {selectBookmarksForProduct} from './bookmarks'
import {PUBLISHERS} from './publishers'

const news = getProduct('news')
function bookmark(did: `did:${string}:${string}`, id: string, missing = false) {
  const uri = `at://${did}/app.bsky.feed.post/${id}` as const
  return {
    subject: {uri, cid: 'bafytest'},
    item: missing
      ? {
          $type: 'app.bsky.feed.defs#notFoundPost' as const,
          uri,
          notFound: true as const,
        }
      : {
          $type: 'app.bsky.feed.defs#postView' as const,
          uri,
          cid: 'bafytest',
          author: {did, handle: 'publisher.test' as const},
          record: {},
          indexedAt: '2026-11-06T00:00:00Z' as const,
        },
  }
}
it.each(PUBLISHERS)(
  'allows $name posts, but not an impersonated handle or a foreign author',
  publisher => {
    const post = {
      uri: `at://${publisher.did}/app.bsky.feed.post/one`,
      author: {did: publisher.did},
    }
    expect(canBookmarkPost(post, news)).toBe(true)
    expect(
      canBookmarkPost({...post, author: {did: 'did:plc:reader'}}, news),
    ).toBe(false)
    expect(
      canBookmarkUri(`at://${publisher.domain}/app.bsky.feed.post/one`, news),
    ).toBe(false)
  },
)
it.each([
  'bad uri',
  'at://did:plc:reader/app.bsky.feed.post/one',
  `at://${PUBLISHERS[0].did}/app.bsky.actor.profile/self`,
])('rejects nonpublisher or nonpost URI %s', uri => {
  expect(canBookmarkUri(uri, news)).toBe(false)
})
it('filters the observer without modifying account bookmarks or pagination cursors', () => {
  const org = bookmark(PUBLISHERS[0].did, 'one')
  const reader = bookmark('did:plc:reader', 'two')
  const deletedOrg = bookmark(PUBLISHERS[1].did, 'three', true)
  const deletedReader = bookmark('did:plc:reader', 'four', true)
  const data = {
    pageParams: [undefined, 'older'],
    pages: [
      {bookmarks: [reader, org, deletedReader], cursor: 'older'},
      {bookmarks: [deletedOrg], cursor: 'next'},
    ],
  }
  const before = JSON.stringify(data)
  const selected = selectBookmarksForProduct(data, news)
  expect(selected.pages.map(page => page.bookmarks)).toEqual([
    [org],
    [deletedOrg],
  ])
  expect(selected.pageParams).toBe(data.pageParams)
  expect(selected.pages.map(page => page.cursor)).toEqual(['older', 'next'])
  expect(JSON.stringify(data)).toBe(before)
  expect(selectBookmarksForProduct(data, getProduct('social'))).toBe(data)
})
it('preserves unrestricted social bookmarks and an explicitly disabled policy', () => {
  expect(
    canBookmarkPost(
      {
        uri: 'at://did:plc:reader/app.bsky.feed.post/one',
        author: {did: 'did:plc:reader'},
      },
      getProduct('social'),
    ),
  ).toBe(true)
  expect(
    canBookmarkUri(`at://${PUBLISHERS[0].did}/app.bsky.feed.post/one`, {
      ...news,
      capabilities: {...news.capabilities, bookmarking: false},
    }),
  ).toBe(false)
})
