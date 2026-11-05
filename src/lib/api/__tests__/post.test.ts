jest.unmock('multiformats/cid')
jest.unmock('multiformats/hashes/hasher')

import {type Client} from '@atproto/lex'
import {toDatetimeString} from '@atproto/syntax'
import {RichText} from '@bsky/sdk/richtext'
import {i18n} from '@lingui/core'
import {QueryClient} from '@tanstack/react-query'

import {type PostDraft} from '#/view/com/composer/state/composer'
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
