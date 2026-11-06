import {type app} from '#/lexicons'
import {PUBLISHERS} from './publishers'
import {isPublisherReply} from './replies'

const actor = 'did:plc:reader'
function reply(root: string, parent = root): app.bsky.feed.defs.FeedViewPost {
  return {
    post: {
      uri: `at://${actor}/app.bsky.feed.post/reply`,
      cid: 'bafyreply',
      indexedAt: '2026-11-05T12:00:00Z',
      author: {did: actor, handle: 'reader.test'},
      record: {
        $type: 'app.bsky.feed.post',
        text: 'A reply',
        createdAt: new Date().toISOString(),
        reply: {
          root: {uri: root, cid: 'bafyroot'},
          parent: {uri: parent, cid: 'bafyparent'},
        },
      },
    },
  }
}

it.each(PUBLISHERS)(
  'keeps direct and nested replies to $name roots',
  publisher => {
    const root = `at://${publisher.did}/app.bsky.feed.post/root`
    expect(isPublisherReply(reply(root), actor)).toBe(true)
    expect(
      isPublisherReply(
        reply(root, 'at://did:plc:another-reader/app.bsky.feed.post/reply'),
        actor,
      ),
    ).toBe(true)
  },
)

it('does not accept a publisher parent when the root belongs to someone else', () => {
  expect(
    isPublisherReply(
      reply(
        'at://did:plc:other/app.bsky.feed.post/root',
        `at://${PUBLISHERS[0].did}/app.bsky.feed.post/parent`,
      ),
      actor,
    ),
  ).toBe(false)
})

it.each([
  'invalid',
  '',
  `at://${PUBLISHERS[0].did}/app.bsky.actor.profile/self`,
  'at://did:plc:other/app.bsky.feed.post/root',
])('rejects nonpublisher or malformed roots: %s', uri => {
  expect(isPublisherReply(reply(uri), actor)).toBe(false)
})

it('rejects originals, reposts and other authors', () => {
  const root = `at://${PUBLISHERS[0].did}/app.bsky.feed.post/root`
  const post = reply(root)
  expect(
    isPublisherReply(
      {
        ...post,
        reason: {
          $type: 'app.bsky.feed.defs#reasonRepost',
          by: {did: actor, handle: 'reader.test'},
          indexedAt: '2026-11-05T12:00:00Z',
        },
      },
      actor,
    ),
  ).toBe(false)
  expect(isPublisherReply(post, 'did:plc:someone-else')).toBe(false)
  delete post.post.record.reply
  expect(isPublisherReply(post, actor)).toBe(false)
})
