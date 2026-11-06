import {type Client} from '@atproto/lex'

import {app} from '#/lexicons'
import {PublisherFeedAPI} from './feed'

function item(
  actor: string,
  index: number,
  extra: object = {},
): app.bsky.feed.defs.FeedViewPost {
  return {
    post: {
      $type: 'app.bsky.feed.defs#postView',
      uri: `at://${actor}/app.bsky.feed.post/${index}`,
      cid: 'bafytest',
      author: {did: actor, handle: `${actor}.test`},
      record: {
        $type: 'app.bsky.feed.post',
        text: `Story ${index}`,
        createdAt: new Date().toISOString(),
      },
      indexedAt: new Date().toISOString(),
    },
    ...extra,
  } as app.bsky.feed.defs.FeedViewPost
}

function clientFor(feeds: Record<string, app.bsky.feed.defs.FeedViewPost[]>) {
  const call = jest.fn(
    (
      _method: unknown,
      params: {actor: string},
      _options?: {signal?: AbortSignal},
    ) => Promise.resolve({feed: feeds[params.actor] ?? []}),
  )
  return {client: {call} as unknown as Client, call}
}

it('round-robins across publishers and continues the same turn on pagination', async () => {
  const {client, call} = clientFor(
    Object.fromEntries(
      ['a', 'b', 'c'].map(did => [
        did,
        [0, 1, 2, 3].map(index => item(did, index)),
      ]),
    ),
  )
  const api = new PublisherFeedAPI({client, dids: ['a', 'b', 'c']})
  const first = await api.fetch({cursor: undefined, limit: 4})
  const second = await api.fetch({cursor: first.cursor, limit: 4})
  expect(first.feed.map(item => item.post.author.did)).toEqual([
    'a',
    'b',
    'c',
    'a',
  ])
  expect(second.feed.map(item => item.post.author.did)).toEqual([
    'b',
    'c',
    'a',
    'b',
  ])
  expect(
    new Set([...first.feed, ...second.feed].map(item => item.post.uri)).size,
  ).toBe(8)
  expect(call).toHaveBeenCalledTimes(3)
  expect(call).toHaveBeenCalledWith(
    app.bsky.feed.getAuthorFeed,
    expect.objectContaining({
      filter: 'posts_no_replies',
      includePins: false,
      limit: 30,
    }),
    {signal: undefined},
  )
})

it('excludes reposts, replies, foreign authors, duplicate posts and old stories', async () => {
  const reply = item('a', 2)
  reply.post.record.reply = {
    root: {uri: 'at://x/app.bsky.feed.post/one', cid: 'bafyr'},
    parent: {uri: 'at://x/app.bsky.feed.post/one', cid: 'bafyp'},
  }
  const old = item('a', 3)
  old.post.record.createdAt = new Date(Date.now() - 8 * 86400000).toISOString()
  const original = item('a', 0)
  const {client} = clientFor({
    a: [
      original,
      original,
      item('a', 1, {reason: {$type: 'app.bsky.feed.defs#reasonRepost'}}),
      reply,
      item('someone-else', 0),
      old,
    ],
  })
  const result = await new PublisherFeedAPI({client, dids: ['a']}).fetch({
    cursor: undefined,
    limit: 30,
  })
  expect(result.feed).toEqual([original])
  expect(result.cursor).toBeUndefined()
})

it('only requests videos for Shorts and excludes GIFs and ordinary posts', async () => {
  const video = item('a', 1)
  video.post.embed = {
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyvideo',
    playlist: 'https://video.example/1.m3u8',
  }
  const gif = item('a', 2)
  gif.post.embed = {...video.post.embed, presentation: 'gif'}
  const {client, call} = clientFor({a: [video, gif, item('a', 3)]})
  const result = await new PublisherFeedAPI({
    client,
    dids: ['a'],
    videos: true,
  }).fetch({cursor: undefined, limit: 30})
  expect(result.feed).toEqual([video])
  expect(call).toHaveBeenCalledWith(
    app.bsky.feed.getAuthorFeed,
    expect.objectContaining({filter: 'posts_with_video'}),
    {signal: undefined},
  )
})

it('keeps successful sources, retries a failing source on the next page, and surfaces total failure', async () => {
  const {client, call} = clientFor({a: [item('a', 0)]})
  call.mockImplementation((_method: unknown, {actor}: {actor: string}) =>
    actor === 'b'
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({feed: [item('a', 0)]}),
  )
  const api = new PublisherFeedAPI({client, dids: ['a', 'b']})
  const first = await api.fetch({cursor: undefined, limit: 30})
  expect(first.feed).toHaveLength(1)
  expect(first.cursor).toBeDefined()
  call.mockImplementation((_method: unknown, {actor}: {actor: string}) =>
    Promise.resolve({feed: actor === 'b' ? [item('b', 0)] : []}),
  )
  const second = await api.fetch({cursor: first.cursor, limit: 30})
  expect(second.feed.map(item => item.post.author.did)).toEqual(['b'])
  call.mockRejectedValue(new Error('offline'))
  await expect(
    new PublisherFeedAPI({client, dids: ['a', 'b']}).fetch({
      cursor: undefined,
      limit: 30,
    }),
  ).rejects.toThrow('offline')
})

it('forwards cancellation and resets queues on refresh', async () => {
  const {client, call} = clientFor({a: [item('a', 0), item('a', 1)]})
  const api = new PublisherFeedAPI({client, dids: ['a']})
  const signal = new AbortController().signal
  const first = await api.fetch({cursor: undefined, limit: 1, signal})
  const refreshed = await api.fetch({cursor: undefined, limit: 1})
  expect(refreshed.feed).toEqual(first.feed)
  expect(call.mock.calls[0][2]).toEqual({signal})
})
