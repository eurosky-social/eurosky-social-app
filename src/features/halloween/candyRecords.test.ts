import {type Client} from '@atproto/lex'

import {com} from '#/lexicons'
import {
  CANDY_COLLECTION,
  giveProfileCandy,
  hasGivenProfileCandy,
} from './candyRecords'

const call = jest.fn<Promise<unknown>, [unknown, unknown]>()
const client = {assertDid: 'did:plc:sender', call} as unknown as Client
beforeEach(() => {
  call.mockReset()
  call.mockResolvedValue({uri: 'created'})
})

it('creates a gift in the sender’s repo referencing the recipient DID, without requiring a post', async () => {
  await giveProfileCandy(client, 'did:plc:recipient')
  expect(call).toHaveBeenCalledWith(com.atproto.repo.createRecord, {
    repo: 'did:plc:sender',
    collection: CANDY_COLLECTION,
    record: {
      $type: CANDY_COLLECTION,
      subject: 'did:plc:recipient',
      createdAt: expect.any(String),
    },
  })
  const input = call.mock
    .calls[0][1] as com.atproto.repo.createRecord.$InputBody
  expect(input).not.toHaveProperty('validate')
  expect(input).not.toHaveProperty('rkey')
  expect(input.record).not.toHaveProperty('post')
})

it('creates a new record on every deliberate click, rather than replacing a singleton', async () => {
  await giveProfileCandy(client, 'did:plc:recipient')
  await giveProfileCandy(client, 'did:plc:recipient')
  expect(call).toHaveBeenCalledTimes(2)
  for (const [, input] of call.mock.calls)
    expect(input).not.toHaveProperty('rkey')
})

it('rejects handles and post URIs as candy subjects', () => {
  expect(() => giveProfileCandy(client, 'alice.example')).toThrow(
    'recipient DID',
  )
  expect(() =>
    giveProfileCandy(client, 'at://did:plc:alice/app.bsky.feed.post/post'),
  ).toThrow('recipient DID')
  expect(call).not.toHaveBeenCalled()
})

describe('hasGivenProfileCandy', () => {
  const originalFetch = global.fetch
  const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('looks up a single gift filtered by sender, recipient, and collection', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [
            {did: 'did:plc:sender', collection: CANDY_COLLECTION, rkey: 'gift'},
          ],
        }),
    } as Response)
    const signal = new AbortController().signal
    await expect(
      hasGivenProfileCandy('did:plc:sender', 'did:plc:recipient', signal),
    ).resolves.toBe(true)
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.origin).toBe('https://constellation.microcosm.blue')
    expect(url.pathname).toBe('/xrpc/blue.microcosm.links.getBacklinks')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      subject: 'did:plc:recipient',
      source: `${CANDY_COLLECTION}:subject`,
      did: 'did:plc:sender',
      limit: '1',
    })
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(signal)
  })

  it.each([
    {records: []},
    {
      records: [
        {
          did: 'did:plc:someone-else',
          collection: CANDY_COLLECTION,
          rkey: 'gift',
        },
      ],
    },
    {
      records: [
        {did: 'did:plc:sender', collection: 'app.bsky.feed.like', rkey: 'like'},
      ],
    },
  ])('does not count absent or unrelated gifts: %j', async ({records}) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({records}),
    } as Response)
    await expect(
      hasGivenProfileCandy('did:plc:sender', 'did:plc:recipient'),
    ).resolves.toBe(false)
  })

  it('keeps lookup failures distinct from no previous gift', async () => {
    fetchMock.mockResolvedValue({ok: false, status: 503} as Response)
    await expect(
      hasGivenProfileCandy('did:plc:sender', 'did:plc:recipient'),
    ).rejects.toThrow('Could not load candy gifts: 503')
  })
})
