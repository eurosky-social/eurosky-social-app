import {type Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {describe, expect, it, jest} from '@jest/globals'

import {
  deleteSupplement,
  listSupplements,
  readSupplement,
  saveSupplement,
  SupplementConflictError,
} from './records'
import {type Supplement, SUPPLEMENT_COLLECTION} from './supplement'

const mockMatch = jest.fn<() => string | undefined>()
const mockNotFound = jest.fn<() => boolean>()
jest.mock('#/lib/xrpc-error', () => ({
  isRecordNotFoundError: () => mockNotFound(),
  matchXrpcError: () => mockMatch(),
}))
jest.mock('#/lexicons', () => ({
  com: {
    atproto: {
      repo: {
        listRecords: 'listRecords',
        getRecord: 'getRecord',
        putRecord: 'putRecord',
        deleteRecord: 'deleteRecord',
      },
    },
  },
}))

const did = 'did:plc:editor' as DidString
const read = {rkey: 'one', cid: 'c1'}
const supplement: Supplement = {
  title: 'De verkiezingen',
  topic: {slug: 'elections', name: 'Elections'},
  startDate: '2026-11-01',
  items: [],
}
const value = {
  ...supplement,
  $type: SUPPLEMENT_COLLECTION,
  version: 1,
  updatedAt: '2026-11-06T12:00:00.000Z',
}

type Call = (
  method: unknown,
  input: Record<string, unknown>,
) => Promise<unknown>

function clientWith(answer: () => Promise<unknown>, assertDid = did) {
  const call = jest.fn<Call>(answer)
  return {
    client: {call, assertDid} as unknown as Client,
    call,
    input: () => call.mock.calls[0][1],
  }
}

const refused = () => Promise.reject(new Error('refused'))

describe('listSupplements', () => {
  it('leaves out a malformed record and keeps the rest', async () => {
    const {client} = clientWith(() =>
      Promise.resolve({
        records: [
          {uri: `at://${did}/${SUPPLEMENT_COLLECTION}/one`, cid: 'c1', value},
          {
            uri: `at://${did}/${SUPPLEMENT_COLLECTION}/two`,
            cid: 'c2',
            value: {...value, startDate: 'soon'},
          },
        ],
      }),
    )
    const list = await listSupplements(client, did)
    expect(list.map(entry => entry.rkey)).toEqual(['one'])
    expect(list[0].supplement.title).toBe('De verkiezingen')
  })
})

describe('readSupplement', () => {
  it('is null when it does not exist', async () => {
    mockNotFound.mockReturnValueOnce(true)
    const {client} = clientWith(refused)
    await expect(readSupplement(client, did, 'one')).resolves.toBeNull()
  })

  it('throws on a malformed record instead of showing nothing', async () => {
    mockNotFound.mockReturnValueOnce(false)
    const {client} = clientWith(() =>
      Promise.resolve({cid: 'c1', value: {...value, version: 2}}),
    )
    await expect(readSupplement(client, did, 'one')).rejects.toThrow()
  })
})

describe('saveSupplement', () => {
  it('creates under a new key, asserting that none exists', async () => {
    const {client, input} = clientWith(() => Promise.resolve({cid: 'new'}))
    const saved = await saveSupplement(client, did, undefined, supplement)
    expect(input().swapRecord).toBeNull()
    expect(input().rkey).toBe(saved.rkey)
    expect(input().rkey).toMatch(/^[a-z2-7]{13}$/)
    expect(input().record).toMatchObject({$type: SUPPLEMENT_COLLECTION})
    expect(saved.cid).toBe('new')
  })

  it('updates what it read', async () => {
    const {client, input} = clientWith(() => Promise.resolve({cid: 'next'}))
    await saveSupplement(client, did, read, supplement)
    expect(input()).toMatchObject({rkey: 'one', swapRecord: 'c1'})
  })

  it('says so when another editor got there first', async () => {
    mockMatch.mockReturnValueOnce('InvalidSwap')
    const {client} = clientWith(refused)
    await expect(
      saveSupplement(client, did, read, supplement),
    ).rejects.toBeInstanceOf(SupplementConflictError)
  })

  it('refuses another account’s supplement before calling anything', async () => {
    const {client, call} = clientWith(
      () => Promise.resolve({}),
      'did:plc:other',
    )
    await expect(
      saveSupplement(client, did, undefined, supplement),
    ).rejects.toThrow('Only its editor')
    expect(call).not.toHaveBeenCalled()
  })
})

describe('deleteSupplement', () => {
  it('deletes what it read', async () => {
    const {client, input} = clientWith(() => Promise.resolve({}))
    await deleteSupplement(client, did, read)
    expect(input()).toMatchObject({rkey: 'one', swapRecord: 'c1'})
  })

  it('refuses another account’s supplement', async () => {
    const {client, call} = clientWith(
      () => Promise.resolve({}),
      'did:plc:other',
    )
    await expect(deleteSupplement(client, did, read)).rejects.toThrow(
      'Only its editor',
    )
    expect(call).not.toHaveBeenCalled()
  })
})
