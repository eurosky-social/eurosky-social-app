import {hasDecorationEntitlement} from './records'

const PROD_LIST =
  'at://did:plc:issuer/app.bsky.graph.list/production-subscribers'
const TEST_LIST = 'at://did:plc:issuer/app.bsky.graph.list/test-subscribers'
const SUBJECT = 'did:plc:subscriber'
const originalFetch = global.fetch

describe('hasDecorationEntitlement', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('checks multiple accepted lists in one many-to-many request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          items: [
            {
              linkRecord: {
                did: 'did:plc:issuer',
                collection: 'app.bsky.graph.listitem',
                rkey: 'manual-tid',
              },
              otherSubject: TEST_LIST,
            },
          ],
        }),
    } as Response)

    await expect(
      hasDecorationEntitlement(SUBJECT, [PROD_LIST, TEST_LIST]),
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

  it('rejects a result whose record owner does not own the matched list', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          items: [
            {
              linkRecord: {
                did: 'did:plc:someone-else',
                collection: 'app.bsky.graph.listitem',
                rkey: 'spoofed',
              },
              otherSubject: PROD_LIST,
            },
          ],
        }),
    } as Response)

    await expect(hasDecorationEntitlement(SUBJECT, [PROD_LIST])).resolves.toBe(
      false,
    )
  })

  it('does not query when no valid list URI is configured', async () => {
    await expect(
      hasDecorationEntitlement(SUBJECT, ['not-an-at-uri']),
    ).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
