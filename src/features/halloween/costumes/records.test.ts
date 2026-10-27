jest.unmock('multiformats/cid')

import {CID, type Client, getMain, XrpcResponseError} from '@atproto/lex'

import {com} from '#/lexicons'
import {createCostume} from './model'
import {
  COSTUME_COLLECTION,
  CostumeConflictError,
  type CostumeSource,
  fetchCostumeRecord,
  isCostumePost,
  loadCostumeSource,
  originalAvatarUrl,
  parseCostumeRecord,
  publishCostume,
} from './records'

const avatar = {
  $type: 'blob' as const,
  ref: CID.parse('bafkreieq5jui4j25lacwomsqgjeswwl3y5zcdrresptwgmfylxo2depppq'),
  mimeType: 'image/png',
  size: 500,
}
const otherAvatar = {
  ...avatar,
  ref: CID.createV1(
    0x55,
    CID.parse('bafyreiem7g6vja66nebr7he4fshfnlyndyldbvle2n265oixscmepjcbii')
      .multihash,
  ),
}
const source = (): CostumeSource => ({
  head: avatar.ref.toString(),
  profile: {
    $type: 'app.bsky.actor.profile',
    displayName: 'Alice',
    description: 'Keep me',
    avatar,
  },
  hasProfile: true,
  originalAvatar: avatar,
  costume: undefined,
})
let current: CostumeSource
let writeFailure: Error | undefined
const call = jest.fn<Promise<unknown>, [unknown, unknown]>()
const client = {assertDid: 'did:plc:alice', call} as unknown as Client

function appliedWrites() {
  return call.mock.calls
    .filter(([method]) => method === com.atproto.repo.applyWrites)
    .map(([, input]) => input as com.atproto.repo.applyWrites.$InputBody)
}

beforeEach(() => {
  current = source()
  writeFailure = undefined
  call.mockReset()
  call.mockImplementation((method, input) => {
    if (method === com.atproto.sync.getLatestCommit)
      return Promise.resolve({cid: current.head})
    if (method === com.atproto.repo.getRecord) {
      const {collection} = input as {collection: string}
      const notFound = () =>
        Promise.reject(
          new XrpcResponseError(
            getMain(com.atproto.repo.getRecord),
            new Response('', {status: 400}),
            {encoding: 'application/json', body: {error: 'RecordNotFound'}},
          ),
        )
      if (collection === 'app.bsky.actor.profile')
        return current.hasProfile
          ? Promise.resolve({value: current.profile})
          : notFound()
      if (current.costume) return Promise.resolve({value: current.costume})
      return notFound()
    }
    if (writeFailure) return Promise.reject(writeFailure)
    return Promise.resolve({})
  })
})

it('atomically updates the public avatar and starts the singleton counter at one', async () => {
  const record = await publishCostume(client, source(), createCostume(), avatar)
  expect(record.costumeNumber).toBe(1)
  const input = appliedWrites()[0]
  expect(input.repo).toBe('did:plc:alice')
  expect(input.swapCommit).toBe(source().head)
  expect(input).not.toHaveProperty('validate')
  expect(input.writes).toEqual([
    expect.objectContaining({
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      value: expect.objectContaining({
        description: 'Keep me',
        displayName: 'Alice',
        avatar,
      }),
    }),
    expect.objectContaining({
      collection: COSTUME_COLLECTION,
      rkey: 'self',
      $type: 'com.atproto.repo.applyWrites#create',
      value: record,
    }),
  ])
  expect(record.originalAvatar).toEqual(avatar)
  expect(record.post).toBeUndefined()
  expect(parseCostumeRecord(record)).toEqual(record)
})

it('creates the profile record for accounts that never wrote one', async () => {
  current = {
    ...source(),
    hasProfile: false,
    profile: {$type: 'app.bsky.actor.profile'},
    originalAvatar: undefined,
  }
  const loaded = await loadCostumeSource(client)
  expect(loaded).toEqual(
    expect.objectContaining({hasProfile: false, originalAvatar: undefined}),
  )
  await publishCostume(client, loaded, createCostume(), avatar)
  expect(appliedWrites()[0].writes[0]).toEqual(
    expect.objectContaining({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      value: {$type: 'app.bsky.actor.profile', avatar},
    }),
  )
})

it('increments once per change and clears the previous collection post, not the original avatar', async () => {
  const first = await publishCostume(client, source(), createCostume(), avatar)
  current = {...source(), costume: {...first, post: 'at://old/post'}}
  const second = await publishCostume(client, current, createCostume(), avatar)
  current = {...source(), costume: second}
  const third = await publishCostume(client, current, createCostume(), avatar)
  expect([
    first.costumeNumber,
    second.costumeNumber,
    third.costumeNumber,
  ]).toEqual([1, 2, 3])
  expect(second.post).toBeUndefined()
  expect(third.originalAvatar).toEqual(avatar)
  expect(appliedWrites()[2].writes[1].$type).toBe(
    'com.atproto.repo.applyWrites#update',
  )
})

it('uses the latest repo head and preserves unrelated profile edits made while drawing', async () => {
  const initial = source()
  current = {
    ...source(),
    head: otherAvatar.ref.toString(),
    profile: {...source().profile, description: 'Updated in another window'},
  }
  await publishCostume(client, initial, createCostume(), otherAvatar)
  expect(appliedWrites()[0].swapCommit).toBe(current.head)
  expect(appliedWrites()[0].writes[0]).toEqual(
    expect.objectContaining({
      value: expect.objectContaining({
        description: 'Updated in another window',
        avatar: otherAvatar,
      }),
    }),
  )
})

it('does not overwrite a profile photo changed in another window', async () => {
  const initial = source()
  current = {...source(), profile: {...source().profile, avatar: otherAvatar}}
  await expect(
    publishCostume(client, initial, createCostume(), avatar),
  ).rejects.toBeInstanceOf(CostumeConflictError)
  expect(appliedWrites()).toHaveLength(0)
})

it('does not overwrite a newer costume or double-increment after an ambiguous prior save', async () => {
  const initial = source()
  const record = await publishCostume(client, initial, createCostume(), avatar)
  current = {...source(), costume: record}
  call.mockClear()
  await expect(
    publishCostume(client, initial, createCostume(), avatar),
  ).rejects.toBeInstanceOf(CostumeConflictError)
  expect(appliedWrites()).toHaveLength(0)
})

it('does not retry an ambiguous network failure', async () => {
  call.mockRejectedValueOnce(new Error('Network failure'))
  await expect(
    publishCostume(client, source(), createCostume(), avatar),
  ).rejects.toThrow('Network failure')
  expect(call).toHaveBeenCalledTimes(1)
  expect(appliedWrites()).toHaveLength(0)
})

it('still lets the PDS reject a commit race during the final atomic write', async () => {
  writeFailure = new Error('InvalidSwap')
  await expect(
    publishCostume(client, source(), createCostume(), avatar),
  ).rejects.toThrow('InvalidSwap')
  expect(appliedWrites()).toHaveLength(1)
})

it('loads the head before the records and reads the original photo through the account PDS, not the CDN', async () => {
  const record = await publishCostume(client, source(), createCostume(), avatar)
  current = {...source(), costume: {...record, originalAvatar: otherAvatar}}
  call.mockClear()
  const result = await loadCostumeSource(client)
  expect(call.mock.calls[0][1]).toEqual({did: 'did:plc:alice'})
  expect(result.originalAvatar).toEqual(otherAvatar)
  const url = new URL(
    originalAvatarUrl('did:plc:alice', result, 'https://user-pds.example')!,
  )
  expect(url.origin).toBe('https://user-pds.example')
  expect(url.pathname).toBe('/xrpc/com.atproto.sync.getBlob')
  expect(url.searchParams.get('did')).toBe('did:plc:alice')
  expect(url.searchParams.get('cid')).toBe(otherAvatar.ref.toString())
})

it('does not request a photo for an account without an original avatar', () => {
  expect(
    originalAvatarUrl(
      'did:plc:alice',
      {...source(), originalAvatar: undefined},
      'https://user-pds.example',
    ),
  ).toBeUndefined()
})

it('rejects invalid records and requires an exact boolean post marker', () => {
  expect(parseCostumeRecord({costumeNumber: -1})).toBeUndefined()
  expect(isCostumePost({isHalloweenCostume: 'true'})).toBe(false)
  expect(isCostumePost({isHalloweenCostume: true})).toBe(true)
})

it('returns null for absent public records, without turning absence into a failed query', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('', {status: 404}))
  try {
    expect(await fetchCostumeRecord('did:plc:alice')).toBeNull()
    expect(fetch.mock.calls[0][0]).toEqual(
      expect.stringContaining('collection=social.mu.halloween.costume'),
    )
  } finally {
    fetch.mockRestore()
  }
})

it.each([
  [
    'at://did:plc:alice/app.bsky.feed.post/3abc',
    'at://did:plc:alice/app.bsky.feed.post/3abc',
  ],
  ['at://did:plc:bob/app.bsky.feed.post/3abc', undefined],
  ['at://did:plc:alice/app.bsky.feed.post/../bad', undefined],
])('only links to the costume owner’s own post: %s', async (post, expected) => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        value: {$type: COSTUME_COLLECTION, costumeNumber: 3, post},
      }),
    ),
  )
  try {
    expect(await fetchCostumeRecord('did:plc:alice')).toEqual({
      costumeNumber: 3,
      post: expected,
    })
  } finally {
    fetch.mockRestore()
  }
})
