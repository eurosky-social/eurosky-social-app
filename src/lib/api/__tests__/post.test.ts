jest.unmock('multiformats/cid')
jest.unmock('multiformats/hashes/hasher')

import {type Client} from '@atproto/lex'
import {toDatetimeString} from '@atproto/syntax'
import {RichText} from '@bsky/sdk/richtext'
import {i18n} from '@lingui/core'
import {QueryClient} from '@tanstack/react-query'

import {type PostDraft} from '#/view/com/composer/state/composer'
import {
  forgetPostedComment,
  postedCommentsOn,
} from '#/features/mediaTime/postedComments'
import {com} from '#/lexicons'
import {post} from '../index'

jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/state/gallery', () => ({compressImage: jest.fn()}))
jest.mock('#/state/queries/resolve-link', () => ({
  fetchResolveGifQuery: jest.fn(),
  fetchResolveLinkQuery: jest.fn(),
}))
jest.mock('#/state/queries/threadgate', () => ({
  createThreadgateRecord: jest.fn(),
  threadgateAllowUISettingToAllowRecordValue: jest.fn(),
}))

it('publishes ordinary posts in one validated batch, ignoring obsolete seasonal metadata', async () => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  const call = jest
    .fn<Promise<unknown>, [unknown, com.atproto.repo.applyWrites.$InputBody]>()
    .mockResolvedValue({})
  const client = {assertDid: 'did:plc:alice', call} as unknown as Client
  const createDraft = (id: string): PostDraft => ({
    id,
    richtext: new RichText({text: `Post ${id}`}),
    labels: [],
    embed: {media: undefined, quote: undefined, link: undefined},
    shortenedGraphemeLength: 6,
  })
  const legacyDraft = {...createDraft('1'), halloweenCostumeNumber: 3}
  const {uris} = await post(new QueryClient(), {
    thread: {
      posts: [legacyDraft, createDraft('2')],
      threadgate: [{type: 'everybody'}],
      postgate: {
        $type: 'app.bsky.feed.postgate',
        createdAt: toDatetimeString(new Date()),
        post: 'at://did:plc:alice/app.bsky.feed.post/placeholder',
      },
    },
    appviewClient: client,
    pdsClient: client,
    chatClient: client,
  })

  expect(uris).toHaveLength(2)
  expect(call).toHaveBeenCalledTimes(1)
  expect(call).toHaveBeenCalledWith(com.atproto.repo.applyWrites, {
    repo: 'did:plc:alice',
    validate: true,
    writes: uris.map((uri, index) =>
      expect.objectContaining({
        $type: 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.feed.post',
        rkey: uri.split('/').at(-1),
        value: expect.objectContaining({
          $type: 'app.bsky.feed.post',
          text: `Post ${index + 1}`,
        }),
      }),
    ),
  })
  for (const write of call.mock.calls[0][1].writes) {
    expect(write).not.toHaveProperty('value.isHalloweenCostume')
  }
})

it('links only the first post to a second of the replied-to video', async () => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  const call = jest
    .fn<Promise<unknown>, [unknown, com.atproto.repo.applyWrites.$InputBody]>()
    .mockImplementation((method: unknown) => {
      if (method === com.atproto.repo.applyWrites) return Promise.resolve({})
      // resolveReply: the replied-to post
      return Promise.resolve({
        posts: [
          {
            uri: 'at://did:plc:bob/app.bsky.feed.post/3lvideo',
            cid: 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm',
            record: {},
          },
        ],
      })
    })
  const client = {assertDid: 'did:plc:alice', call} as unknown as Client
  const createDraft = (id: string, text: string): PostDraft => ({
    id,
    richtext: new RichText({text}),
    labels: [],
    embed: {media: undefined, quote: undefined, link: undefined},
    shortenedGraphemeLength: text.length,
  })

  const {uris} = await post(new QueryClient(), {
    thread: {
      posts: [createDraft('1', 'This part!'), createDraft('2', 'And more')],
      threadgate: [{type: 'everybody'}],
      postgate: {
        $type: 'app.bsky.feed.postgate',
        createdAt: toDatetimeString(new Date()),
        post: 'at://did:plc:alice/app.bsky.feed.post/placeholder',
      },
    },
    replyTo: 'at://did:plc:bob/app.bsky.feed.post/3lvideo',
    mediaTime: {
      videoPostUri: 'at://did:plc:bob/app.bsky.feed.post/3lvideo',
      seconds: 41,
    },
    appviewClient: client,
    pdsClient: client,
    chatClient: client,
  })

  const writes = call.mock.calls.find(
    ([method]) => method === com.atproto.repo.applyWrites,
  )![1].writes as {value: Record<string, unknown>}[]
  const [first, second] = writes.map(w => w.value)

  expect(first['network.eurosky.mediaTime']).toEqual({
    $type: 'network.eurosky.mediaTime',
    seconds: 41,
  })
  expect(first.text).toBe('This part! ▶︎ 0:41')
  expect(first.facets).toEqual([
    {
      // "This part! " is 11 bytes; the link is 11 more (3 + 3 + " 0:41")
      index: {byteStart: 11, byteEnd: 22},
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: expect.stringMatching(
            /^https:\/\/[^/]+\/profile\/did:plc:bob\/post\/3lvideo\?t=41$/,
          ),
        },
      ],
    },
  ])
  expect(second).not.toHaveProperty(['network.eurosky.mediaTime'])
  expect(second.text).toBe('And more')

  // the video's moments show the new comment before the AppView counts it
  expect(
    postedCommentsOn('at://did:plc:bob/app.bsky.feed.post/3lvideo'),
  ).toEqual([{uri: uris[0], seconds: 41}])
  forgetPostedComment(uris[0])
})

it('ignores an invalid media time', async () => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  const call = jest
    .fn<Promise<unknown>, [unknown, com.atproto.repo.applyWrites.$InputBody]>()
    .mockResolvedValue({})
  const client = {assertDid: 'did:plc:alice', call} as unknown as Client
  await post(new QueryClient(), {
    thread: {
      posts: [
        {
          id: '1',
          richtext: new RichText({text: 'Hi'}),
          labels: [],
          embed: {media: undefined, quote: undefined, link: undefined},
          shortenedGraphemeLength: 2,
        },
      ],
      threadgate: [{type: 'everybody'}],
      postgate: {
        $type: 'app.bsky.feed.postgate',
        createdAt: toDatetimeString(new Date()),
        post: 'at://did:plc:alice/app.bsky.feed.post/placeholder',
      },
    },
    mediaTime: {
      videoPostUri: 'at://did:plc:bob/app.bsky.feed.post/3lvideo',
      seconds: -1,
    },
    appviewClient: client,
    pdsClient: client,
    chatClient: client,
  })
  const value = (call.mock.calls[0][1].writes[0] as {value: object}).value
  expect(value).not.toHaveProperty(['network.eurosky.mediaTime'])
  expect(value).toHaveProperty('text', 'Hi')
  expect(
    postedCommentsOn('at://did:plc:bob/app.bsky.feed.post/3lvideo'),
  ).toEqual([])
})
