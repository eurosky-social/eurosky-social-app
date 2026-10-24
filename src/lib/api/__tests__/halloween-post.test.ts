jest.unmock('multiformats/cid')
jest.unmock('multiformats/hashes/hasher')

import {CID, type Client, getMain, XrpcResponseError} from '@atproto/lex'
import {RichText} from '@bsky/sdk/richtext'
import {i18n} from '@lingui/core'
import {QueryClient} from '@tanstack/react-query'

import {
  type PostDraft,
  type ThreadDraft,
} from '#/view/com/composer/state/composer'
import {createCostume} from '#/features/halloween/costumes/model'
import {COSTUME_COLLECTION} from '#/features/halloween/costumes/records'
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
const did = 'did:plc:alice'
const blob = {
  $type: 'blob' as const,
  ref: CID.parse('bafkreieq5jui4j25lacwomsqgjeswwl3y5zcdrresptwgmfylxo2depppq'),
  mimeType: 'image/png',
  size: 50,
}
const costume = {
  $type: COSTUME_COLLECTION,
  costumeNumber: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  avatar: blob,
  drawing: createCostume(),
}
type WriteInput = {
  swapCommit?: string
  writes: {collection: string; value: Record<string, unknown>}[]
}
const call = jest.fn<Promise<unknown>, [unknown, unknown]>()
const client = {assertDid: did, call} as unknown as Client
const draft = (number?: number): PostDraft => ({
  id: String(number),
  richtext: new RichText({text: 'Trick or treat'}),
  halloweenCostumeNumber: number,
  labels: [],
  embed: {media: undefined, quote: undefined, link: undefined},
  shortenedGraphemeLength: 14,
})
const publish = (posts: PostDraft[]) =>
  post(new QueryClient(), {
    thread: {
      posts,
      threadgate: [{type: 'everybody'}],
      postgate: {post: ''},
    } as unknown as ThreadDraft,
    appviewClient: client,
    pdsClient: client,
    chatClient: client,
  })

beforeEach(() => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  call.mockReset()
  call.mockImplementation(method => {
    if (method === com.atproto.sync.getLatestCommit)
      return Promise.resolve({cid: 'head'})
    if (method === com.atproto.repo.getRecord)
      return Promise.resolve({value: costume})
    return Promise.resolve({})
  })
})

it('tags only the costume post and links it from the self record in the same atomic transaction', async () => {
  const {uris} = await publish([draft(3), draft()])
  const input = call.mock.calls.find(
    ([method]) => method === com.atproto.repo.applyWrites,
  )![1] as WriteInput
  expect(input.swapCommit).toBe('head')
  expect(input).not.toHaveProperty('validate')
  const writes = input.writes
  const posts = writes.filter(
    (write: {collection: string}) => write.collection === 'app.bsky.feed.post',
  )
  expect(posts[0].value.isHalloweenCostume).toBe(true)
  expect(posts[1].value).not.toHaveProperty('isHalloweenCostume')
  expect(writes[0]).toEqual(
    expect.objectContaining({
      collection: COSTUME_COLLECTION,
      rkey: 'self',
      value: {...costume, post: uris[0]},
    }),
  )
})

it('does not read or modify costume records for normal posts', async () => {
  await publish([draft()])
  expect(call).toHaveBeenCalledTimes(1)
  expect(call.mock.calls[0][1]).not.toHaveProperty('swapCommit')
  expect(call.mock.calls[0][1]).toEqual(
    expect.objectContaining({validate: true}),
  )
  expect(
    (call.mock.calls[0][1] as WriteInput).writes[0].value,
  ).not.toHaveProperty('isHalloweenCostume')
})

it('rejects a stale costume composer before writing anything', async () => {
  await expect(publish([draft(2)])).rejects.toThrow('Your costume has changed')
  expect(
    call.mock.calls.some(([method]) => method === com.atproto.repo.applyWrites),
  ).toBe(false)
})

const invalidSwap = () =>
  new XrpcResponseError(
    getMain(com.atproto.repo.applyWrites),
    new Response('', {status: 400}),
    {encoding: 'application/json', body: {error: 'InvalidSwap'}},
  )
const writeCalls = () =>
  call.mock.calls.filter(([method]) => method === com.atproto.repo.applyWrites)

it('retries once at a fresh head when an unrelated write lands while posting', async () => {
  let head = 0
  let rejected = false
  call.mockImplementation((method, input) => {
    if (method === com.atproto.sync.getLatestCommit)
      return Promise.resolve({cid: `head-${++head}`})
    if (method === com.atproto.repo.getRecord)
      return Promise.resolve({value: costume})
    if (method === com.atproto.repo.applyWrites && !rejected) {
      rejected = true
      return Promise.reject(invalidSwap())
    }
    return Promise.resolve(input)
  })
  const {uris} = await publish([draft(3)])
  const writes = writeCalls()
  expect(writes).toHaveLength(2)
  expect((writes[0][1] as WriteInput).swapCommit).toBe('head-1')
  expect((writes[1][1] as WriteInput).swapCommit).toBe('head-2')
  expect((writes[1][1] as WriteInput).writes[0].value.post).toBe(uris[0])
})

it('gives up with a clear message after a second race, without a third write', async () => {
  call.mockImplementation(method => {
    if (method === com.atproto.sync.getLatestCommit)
      return Promise.resolve({cid: 'head'})
    if (method === com.atproto.repo.getRecord)
      return Promise.resolve({value: costume})
    return Promise.reject(invalidSwap())
  })
  await expect(publish([draft(3)])).rejects.toThrow(
    'Your account was updated while posting',
  )
  expect(writeCalls()).toHaveLength(2)
})

it('does not retry other write failures', async () => {
  call.mockImplementation(method => {
    if (method === com.atproto.sync.getLatestCommit)
      return Promise.resolve({cid: 'head'})
    if (method === com.atproto.repo.getRecord)
      return Promise.resolve({value: costume})
    return Promise.reject(new Error('Server exploded'))
  })
  await expect(publish([draft(3)])).rejects.toThrow('Server exploded')
  expect(writeCalls()).toHaveLength(1)
})

it('re-checks the costume at write time, after slow uploads', async () => {
  let reads = 0
  call.mockImplementation(method => {
    if (method === com.atproto.sync.getLatestCommit)
      return Promise.resolve({cid: 'head'})
    if (method === com.atproto.repo.getRecord)
      return Promise.resolve({
        value: ++reads === 1 ? costume : {...costume, costumeNumber: 4},
      })
    return Promise.resolve({})
  })
  await expect(publish([draft(3)])).rejects.toThrow('Your costume has changed')
  expect(writeCalls()).toHaveLength(0)
})
