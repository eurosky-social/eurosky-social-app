import {type PropsWithChildren} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, renderHook, waitFor} from '@testing-library/react-native'

import {com} from '#/lexicons'
import {
  canonicalTileUri,
  installedTiles,
  parseTileInstall,
  TILE_INSTALL_COLLECTION,
  UntrustedTileInstallError,
  useTileInstall,
} from './installs'

const mockCall = jest.fn<Promise<unknown>, [unknown, Record<string, unknown>]>()
const mockFetchTileRecord = jest.fn<Promise<unknown>, [string]>()
const mockIsTrusted = jest.fn<Promise<boolean>, unknown[]>()
let mockResolvedDid: string | undefined

jest.mock('#/state/queries', () => ({STALE: {MINUTES: {FIVE: 300000}}}))
jest.mock('#/state/queries/util', () => ({
  createQueryKey: (root: string, args: unknown) => [root, args],
}))
jest.mock('#/state/session', () => ({
  usePdsClient: () => ({call: mockCall}),
  useAppviewClient: () => ({}),
  useSession: () => ({currentAccount: {did: 'did:plc:me'}}),
}))
jest.mock('#/state/queries/resolve-uri', () => ({
  useResolveDidQuery: (handle: string | undefined) => ({
    data: handle ? mockResolvedDid : undefined,
  }),
}))
jest.mock('./author', () => ({
  fetchIsTrustedTile: (...args: unknown[]) => mockIsTrusted(...args),
}))
jest.mock('./resolve', () => ({
  fetchTileRecord: (uri: string) => mockFetchTileRecord(uri),
}))

const INSTALL = 'at://did:plc:me/social.mu.tiles.install/3lf2k7abcde2a'
const TILE = 'at://did:plc:author/ing.dasl.masl/minesweeper'

describe('parseTileInstall', () => {
  it('reads the tile, the CID it had, and the install record key', () => {
    expect(
      parseTileInstall(INSTALL, {
        $type: 'social.mu.tiles.install',
        subject: {uri: TILE, cid: 'bafyrecord'},
        createdAt: '2026-11-27T10:00:00.000Z',
      }),
    ).toEqual({
      rkey: '3lf2k7abcde2a',
      tile: {uri: TILE, cid: 'bafyrecord'},
      createdAt: '2026-11-27T10:00:00.000Z',
    })
  })

  it('refuses a subject that is not a tile, or names it by handle', () => {
    const at = (uri: unknown) =>
      parseTileInstall(INSTALL, {subject: {uri}, createdAt: 'x'})
    expect(at('at://did:plc:author/app.bsky.feed.post/abc')).toBe(undefined)
    expect(at('at://robin.berjon.com/ing.dasl.masl/bad')).toBe(undefined)
    expect(at('https://example.com/')).toBe(undefined)
    expect(at(undefined)).toBe(undefined)
    expect(parseTileInstall(INSTALL, null)).toBe(undefined)
    expect(parseTileInstall(INSTALL, {subject: TILE})).toBe(undefined)
  })

  it('refuses a record whose own address has no key', () => {
    expect(
      parseTileInstall('not a uri', {subject: {uri: TILE}, createdAt: 'x'}),
    ).toBe(undefined)
  })

  it('tolerates a missing CID and date', () => {
    expect(parseTileInstall(INSTALL, {subject: {uri: TILE}})).toEqual({
      rkey: '3lf2k7abcde2a',
      tile: {uri: TILE, cid: undefined},
      createdAt: '',
    })
  })
})

describe('installedTiles', () => {
  const install = (rkey: string, tile: string, createdAt: string) => ({
    rkey,
    tile: {uri: canonicalTileUri('did:plc:author', tile)},
    createdAt,
  })

  it('lists each tile once, the latest installed first', () => {
    const installs = [
      install('a', 'chess', '2026-11-01T00:00:00.000Z'),
      install('b', 'mines', '2026-11-20T00:00:00.000Z'),
      install('c', 'chess', '2026-11-25T00:00:00.000Z'),
    ]
    expect(installedTiles(installs).map(i => i.rkey)).toEqual(['c', 'b'])
    // The input is left as it was.
    expect(installs.map(i => i.rkey)).toEqual(['a', 'b', 'c'])
  })
})

describe('canonicalTileUri', () => {
  it('names the tile record in the repo of a DID', () => {
    expect(canonicalTileUri('did:plc:author', 'minesweeper')).toBe(TILE)
  })
})

describe('useTileInstall', () => {
  const OTHER = 'at://did:plc:author/ing.dasl.masl/chess'
  type Stored = {uri: string; value: unknown}
  let stored: Stored[]

  const record = (rkey: string, tile: string): Stored => ({
    uri: `at://did:plc:me/${TILE_INSTALL_COLLECTION}/${rkey}`,
    value: {subject: {uri: tile, cid: 'bafyold'}, createdAt: '2026-11-01'},
  })

  function wrapper({children}: PropsWithChildren) {
    const client = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  beforeEach(() => {
    stored = []
    mockResolvedDid = undefined
    mockCall.mockReset()
    mockFetchTileRecord.mockReset()
    mockIsTrusted.mockReset()
    mockIsTrusted.mockResolvedValue(true)
    mockFetchTileRecord.mockImplementation(uri =>
      Promise.resolve({ref: {uri, cid: 'bafynow'}, manifest: {resources: {}}}),
    )
    // A PDS of two-record pages, so that the listing has to follow the cursor.
    mockCall.mockImplementation((method, params) => {
      if (method === com.atproto.repo.listRecords) {
        const from = params.cursor ? Number(params.cursor) : 0
        const records = stored.slice(from, from + 2)
        return Promise.resolve({
          records,
          cursor: records.length ? String(from + 2) : undefined,
        })
      }
      if (method === com.atproto.repo.createRecord) {
        return Promise.resolve({
          uri: `at://did:plc:me/${TILE_INSTALL_COLLECTION}/3new`,
        })
      }
      return Promise.resolve({})
    })
  })

  const calls = (method: unknown) =>
    mockCall.mock.calls.filter(call => call[0] === method).map(call => call[1])

  it('knows a tile as installed from the records, across pages', async () => {
    stored = [record('a', OTHER), record('b', OTHER), record('c', TILE)]
    const {result} = renderHook(() => useTileInstall(TILE), {wrapper})
    expect(result.current.installed).toBe(undefined)
    await waitFor(() => expect(result.current.installed).toBe(true))
    expect(calls(com.atproto.repo.listRecords)[0]).toMatchObject({
      repo: 'did:plc:me',
      collection: TILE_INSTALL_COLLECTION,
    })
  })

  it('matches a pointer that names the author by handle', async () => {
    stored = [record('a', TILE)]
    mockResolvedDid = 'did:plc:author'
    const {result} = renderHook(
      () => useTileInstall('at://author.test/ing.dasl.masl/minesweeper'),
      {wrapper},
    )
    await waitFor(() => expect(result.current.installed).toBe(true))
    expect(result.current.uri).toBe(TILE)
  })

  it('installs the tile as its record stands, and shows it at once', async () => {
    const {result} = renderHook(() => useTileInstall(TILE), {wrapper})
    await waitFor(() => expect(result.current.installed).toBe(false))
    await act(async () => {
      await result.current.install()
    })
    expect(calls(com.atproto.repo.createRecord)).toEqual([
      {
        repo: 'did:plc:me',
        collection: TILE_INSTALL_COLLECTION,
        record: {
          $type: TILE_INSTALL_COLLECTION,
          subject: {uri: TILE, cid: 'bafynow'},
          createdAt: expect.any(String),
        },
      },
    ])
    await waitFor(() => expect(result.current.installed).toBe(true))
  })

  it('installs nothing by an author who is not verified', async () => {
    mockIsTrusted.mockResolvedValue(false)
    const {result} = renderHook(() => useTileInstall(TILE), {wrapper})
    await waitFor(() => expect(result.current.installed).toBe(false))
    await act(async () => {
      await expect(result.current.install()).rejects.toBeInstanceOf(
        UntrustedTileInstallError,
      )
    })
    expect(calls(com.atproto.repo.createRecord)).toEqual([])
    expect(result.current.installed).toBe(false)
  })

  it('uninstalls by deleting every record of the tile, and no other', async () => {
    stored = [record('a', TILE), record('b', OTHER), record('c', TILE)]
    const {result} = renderHook(() => useTileInstall(TILE), {wrapper})
    await waitFor(() => expect(result.current.installed).toBe(true))
    await act(async () => {
      await result.current.uninstall()
    })
    expect(calls(com.atproto.repo.deleteRecord)).toEqual([
      {repo: 'did:plc:me', collection: TILE_INSTALL_COLLECTION, rkey: 'a'},
      {repo: 'did:plc:me', collection: TILE_INSTALL_COLLECTION, rkey: 'c'},
    ])
    await waitFor(() => expect(result.current.installed).toBe(false))
  })
})
