jest.unmock('multiformats/cid')
jest.unmock('multiformats/hashes/hasher')

import {type Client} from '@atproto/lex'
import {type AtUriString, toDatetimeString} from '@atproto/syntax'
import {RichText} from '@bsky/sdk/richtext'
import {i18n} from '@lingui/core'
import {QueryClient} from '@tanstack/react-query'

import {fetchResolveLinkQuery} from '#/state/queries/resolve-link'
import {type PostDraft} from '#/view/com/composer/state/composer'
import {getProduct, PRODUCT} from '#/config/product'
import {app, com} from '#/lexicons'
import {post} from '../index'

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
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

describe('news publishing restrictions at the write boundary', () => {
  const parentUri =
    'at://did:plc:alice/app.bsky.feed.post/parent' as AtUriString
  const parentCid =
    'bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'

  beforeEach(() => {
    i18n.loadAndActivate({locale: 'en', messages: {}})
    jest.replaceProperty(
      PRODUCT,
      'capabilities',
      getProduct('news').capabilities,
    )
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  function setup({hasQuote = false, hasLink = false} = {}) {
    const call = jest.fn((method: unknown) => {
      if (method === app.bsky.feed.getPosts) {
        return Promise.resolve({
          posts: [{uri: parentUri, cid: parentCid, record: {}}],
        })
      }
      return Promise.resolve({})
    })
    const client = {assertDid: 'did:plc:alice', call} as unknown as Client
    const draft: PostDraft = {
      id: 'draft',
      richtext: new RichText({text: 'Reply'}),
      labels: [],
      embed: {
        media: undefined,
        quote: hasQuote ? {type: 'link', uri: parentUri} : undefined,
        link: hasLink ? {type: 'link', uri: parentUri} : undefined,
      },
      shortenedGraphemeLength: 5,
    }
    return {
      call,
      opts: {
        thread: {
          posts: [draft],
          threadgate: [{type: 'everybody' as const}],
          postgate: {
            $type: 'app.bsky.feed.postgate' as const,
            createdAt: toDatetimeString(new Date()),
            post: parentUri,
          },
        },
        appviewClient: client,
        pdsClient: client,
        chatClient: client,
      },
    }
  }

  it('blocks root posts before any resolution, upload, or write', async () => {
    const {call, opts} = setup()
    await expect(post(new QueryClient(), opts)).rejects.toThrow('not available')
    expect(call).not.toHaveBeenCalled()
  })

  it('blocks a quote restored into a reply draft before any requests', async () => {
    const {call, opts} = setup({hasQuote: true})
    await expect(
      post(new QueryClient(), {...opts, replyTo: parentUri}),
    ).rejects.toThrow('not available')
    expect(call).not.toHaveBeenCalled()
  })

  it('publishes replies and chained replies with the real parent', async () => {
    const {call, opts} = setup()
    opts.thread.posts.push({...opts.thread.posts[0], id: 'second'})
    const {uris} = await post(new QueryClient(), {...opts, replyTo: parentUri})
    expect(uris).toHaveLength(2)
    const writes = call.mock.calls.find(
      ([method]) => method === com.atproto.repo.applyWrites,
    )
    expect(writes).toBeDefined()
    expect(call).toHaveBeenCalledWith(
      com.atproto.repo.applyWrites,
      expect.objectContaining({
        writes: [
          expect.objectContaining({
            value: expect.objectContaining({
              reply: {
                root: {uri: parentUri, cid: parentCid},
                parent: {uri: parentUri, cid: parentCid},
              },
            }),
          }),
          expect.objectContaining({
            value: expect.objectContaining({
              reply: expect.objectContaining({
                parent: expect.objectContaining({uri: uris[0]}),
              }),
            }),
          }),
        ],
      }),
    )
  })

  it('blocks pasted links that resolve into post quotes before applyWrites', async () => {
    const {call, opts} = setup({hasLink: true})
    jest.mocked(fetchResolveLinkQuery).mockResolvedValue({
      type: 'record',
      record: {uri: parentUri, cid: parentCid},
    } as never)
    await expect(
      post(new QueryClient(), {...opts, replyTo: parentUri}),
    ).rejects.toThrow('Quote posts are not available')
    expect(
      call.mock.calls.some(
        ([method]) => method === com.atproto.repo.applyWrites,
      ),
    ).toBe(false)
  })
})
