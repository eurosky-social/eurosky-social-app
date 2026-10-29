import {
  type Client,
  type Procedure,
  type Query,
  XrpcResponseError,
} from '@atproto/lex'
import {describe, expect, it, jest} from '@jest/globals'

import {com} from '#/lexicons'
import {defaultCuration, FRONTPAGE_COLLECTION, setLeadPost} from './curation'
import {CurationConflictError, readCuration, saveCuration} from './records'

const DID = 'did:plc:y57igqldvutzs7gpmmrrqbw7'
const CID = 'bafyreicuration'
function mockClient(did: string = DID) {
  const call = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  return {call, client: {assertDid: did, call} as unknown as Client}
}
function responseError(method: Procedure | Query, error: string) {
  return new XrpcResponseError(
    method,
    new Response(JSON.stringify({error}), {status: 400}),
    {encoding: 'application/json', body: {error}},
  )
}
function record() {
  return {
    $type: FRONTPAGE_COLLECTION,
    version: 1,
    ...defaultCuration(),
    updatedAt: '2026-10-28T12:00:00Z',
  }
}

describe('public front-page records', () => {
  it('reads the publisher repository directly, not the reader repository', async () => {
    const {client, call} = mockClient('did:plc:visitor')
    call.mockResolvedValueOnce({cid: CID, value: record()})
    expect(await readCuration(client, DID)).toEqual({
      cid: CID,
      curation: {...defaultCuration(), leadPost: undefined},
    })
    expect(call).toHaveBeenCalledWith(
      com.atproto.repo.getRecord,
      {repo: DID, collection: FRONTPAGE_COLLECTION, rkey: 'self'},
      {service: null},
    )
  })

  it('round-trips external resources and the selected starter-pack display', async () => {
    const {client, call} = mockClient()
    const pack =
      'at://did:plc:inz4fkbbp7ms3ixufw6xuvdi/app.bsky.graph.starterpack/demo'
    const curation = {
      ...defaultCuration(),
      order: [pack],
      starterPackViews: [{uri: pack, view: 'posts' as const}],
    }
    call.mockResolvedValueOnce({cid: CID})
    await saveCuration(
      client,
      DID,
      {cid: null, curation: defaultCuration()},
      curation,
    )
    expect(call).toHaveBeenCalledWith(
      com.atproto.repo.putRecord,
      expect.objectContaining({
        record: expect.objectContaining({
          starterPackViews: curation.starterPackViews,
        }),
      }),
      {service: null},
    )
    call.mockResolvedValueOnce({cid: CID, value: {...record(), ...curation}})
    expect((await readCuration(client, DID)).curation).toEqual(curation)
  })

  it('only falls back to latest-first when the record does not exist', async () => {
    const {client, call} = mockClient()
    call.mockRejectedValueOnce(
      responseError(com.atproto.repo.getRecord.main, 'RecordNotFound'),
    )
    expect(await readCuration(client, DID)).toEqual({
      cid: null,
      curation: defaultCuration(),
    })
    call.mockRejectedValueOnce(new Error('Network unavailable'))
    await expect(readCuration(client, DID)).rejects.toThrow(
      'Network unavailable',
    )
    call.mockResolvedValueOnce({cid: CID, value: {...record(), version: 999}})
    await expect(readCuration(client, DID)).rejects.toThrow()
    call.mockResolvedValueOnce({value: record()})
    await expect(readCuration(client, DID)).rejects.toThrow('CID')
  })

  it('refuses writes by another account before making any request', async () => {
    const {client, call} = mockClient('did:plc:visitor')
    await expect(
      saveCuration(
        client,
        DID,
        {cid: CID, curation: defaultCuration()},
        defaultCuration(),
      ),
    ).rejects.toThrow('Only the profile owner')
    expect(call).not.toHaveBeenCalled()
  })

  it.each([null, CID])(
    'publishes with compare-and-swap for source CID %s',
    async cid => {
      const {client, call} = mockClient()
      call.mockResolvedValueOnce({cid: 'bafyreinew'})
      const curation = setLeadPost(
        defaultCuration(),
        `at://${DID}/app.bsky.feed.post/lead`,
      )
      expect(
        await saveCuration(
          client,
          DID,
          {cid, curation: defaultCuration()},
          curation,
        ),
      ).toEqual({cid: 'bafyreinew', curation})
      expect(call).toHaveBeenCalledWith(
        com.atproto.repo.putRecord,
        expect.objectContaining({
          repo: DID,
          collection: FRONTPAGE_COLLECTION,
          rkey: 'self',
          swapRecord: cid,
          record: expect.objectContaining({leadPost: curation.leadPost}),
        }),
        {service: null},
      )
    },
  )

  it('keeps concurrent edits from overwriting one another', async () => {
    const {client, call} = mockClient()
    call.mockRejectedValueOnce(
      responseError(com.atproto.repo.putRecord.main, 'InvalidSwap'),
    )
    await expect(
      saveCuration(
        client,
        DID,
        {cid: CID, curation: defaultCuration()},
        defaultCuration(),
      ),
    ).rejects.toBeInstanceOf(CurationConflictError)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('validates post ownership before writing', async () => {
    const {client, call} = mockClient()
    await expect(
      saveCuration(
        client,
        DID,
        {cid: CID, curation: defaultCuration()},
        {
          ...defaultCuration(),
          order: ['at://did:plc:visitor/app.bsky.feed.post/other'],
        },
      ),
    ).rejects.toThrow()
    expect(call).not.toHaveBeenCalled()
  })
})
