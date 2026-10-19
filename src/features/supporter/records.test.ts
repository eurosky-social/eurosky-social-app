import {hasSupporterEntitlement} from './records'

const PROD_LIST =
  'at://did:plc:issuer/app.bsky.graph.list/production-subscribers'
const TEST_LIST = 'at://did:plc:issuer/app.bsky.graph.list/test-subscribers'
const SUBJECT = 'did:plc:subscriber'
const originalFetch = global.fetch

function membership(list = TEST_LIST, owner = 'did:plc:issuer') {
  return {
    linkRecord: {
      did: owner,
      collection: 'app.bsky.graph.listitem',
      rkey: 'manual-tid',
    },
    otherSubject: list,
  }
}

describe('hasSupporterEntitlement', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function respond(items: ReturnType<typeof membership>[]) {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({items}),
    } as Response)
  }

  it('checks multiple accepted lists in one request, with no settings-record fetch', async () => {
    respond([membership()])
    await expect(
      hasSupporterEntitlement(SUBJECT, [PROD_LIST, TEST_LIST]),
    ).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/xrpc/blue.microcosm.links.getManyToMany')
    expect(url.searchParams.get('subject')).toBe(SUBJECT)
    expect(url.searchParams.get('source')).toBe(
      'app.bsky.graph.listitem:subject',
    )
    expect(url.searchParams.get('pathToOther')).toBe('list')
    expect(url.searchParams.getAll('otherSubject')).toEqual([
      PROD_LIST,
      TEST_LIST,
    ])
    expect(url.searchParams.getAll('did')).toEqual(['did:plc:issuer'])
  })

  it('rejects a record not owned by the matched list owner', async () => {
    respond([membership(PROD_LIST, 'did:plc:someone-else')])
    await expect(hasSupporterEntitlement(SUBJECT, [PROD_LIST])).resolves.toBe(
      false,
    )
  })

  it('rejects membership in an unconfigured list', async () => {
    respond([membership(TEST_LIST)])
    await expect(hasSupporterEntitlement(SUBJECT, [PROD_LIST])).resolves.toBe(
      false,
    )
  })

  it('does not award a badge when membership is absent', async () => {
    respond([])
    await expect(hasSupporterEntitlement(SUBJECT, [PROD_LIST])).resolves.toBe(
      false,
    )
  })

  it('does not query when no valid list URI is configured', async () => {
    await expect(
      hasSupporterEntitlement(SUBJECT, ['not-an-at-uri']),
    ).resolves.toBe(false)
    await expect(hasSupporterEntitlement(SUBJECT, [])).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates indexer failures so a cached badge is not overwritten with false', async () => {
    fetchMock.mockResolvedValue({ok: false, status: 503} as Response)
    await expect(hasSupporterEntitlement(SUBJECT, [PROD_LIST])).rejects.toThrow(
      '503',
    )
  })
})
