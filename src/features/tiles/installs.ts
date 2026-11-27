import {type Client} from '@atproto/lex'
import {AtUri, type AtUriString, type DidString} from '@atproto/syntax'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {com} from '#/lexicons'
import {fetchIsTrustedTile} from './author'
import {TILE_COLLECTION} from './constants'
import {parseTileUri} from './detect'
import {type TileRef} from './record'
import {fetchTileRecord, type TileRecord} from './resolve'

/**
 * The record that says an account has installed a tile
 * (lexicons/social/mu/tiles/install.json): one per tile, in the account's own
 * repo, pointing at the tile's `ing.dasl.masl` record. It is the tile that is
 * installed, not a post that carries it, so the same tile is installed
 * whichever post it was installed from. Deleting the record uninstalls it.
 */
export const TILE_INSTALL_COLLECTION = 'social.mu.tiles.install'

/** As many installs as are read: more than anyone's list of apps should hold. */
const MAX_INSTALLS = 500

export type TileInstall = {
  /** The record key of the install record, in the account's own repo. */
  rkey: string
  /** The installed tile, its repo always a DID. */
  tile: TileRef
  createdAt: string
}

/** A tile's at-URI with its repo as a DID, the form installs are kept by. */
export function canonicalTileUri(did: string, rkey: string): AtUriString {
  return `at://${did}/${TILE_COLLECTION}/${rkey}`
}

/**
 * The install a record holds. Undefined for anything that does not point at
 * a tile by DID: a handle can change hands, so it never names an install.
 */
export function parseTileInstall(
  uri: string,
  value: unknown,
): TileInstall | undefined {
  if (!value || typeof value !== 'object') return undefined
  const {subject, createdAt} = value as {
    subject?: unknown
    createdAt?: unknown
  }
  if (!subject || typeof subject !== 'object') return undefined
  const {uri: tileUri, cid} = subject as {uri?: unknown; cid?: unknown}
  const tile = typeof tileUri === 'string' ? parseTileUri(tileUri) : undefined
  if (!tile || !tile.repo.startsWith('did:')) return undefined
  let rkey: string
  try {
    rkey = new AtUri(uri).rkey
  } catch {
    return undefined
  }
  if (!rkey) return undefined
  return {
    rkey,
    tile: {
      uri: canonicalTileUri(tile.repo, tile.rkey),
      cid: typeof cid === 'string' ? cid : undefined,
    },
    createdAt: typeof createdAt === 'string' ? createdAt : '',
  }
}

/**
 * The installed tiles, one entry each, the latest installed first. Two
 * devices can each write a record for the same tile; the list shows it once.
 */
export function installedTiles(installs: TileInstall[]): TileInstall[] {
  const seen = new Set<string>()
  return [...installs]
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    .filter(install => {
      if (seen.has(install.tile.uri)) return false
      seen.add(install.tile.uri)
      return true
    })
}

async function fetchTileInstalls(
  pdsClient: Client,
  did: DidString,
): Promise<TileInstall[]> {
  const installs: TileInstall[] = []
  let cursor: string | undefined
  do {
    const page = await pdsClient.call(com.atproto.repo.listRecords, {
      repo: did,
      collection: TILE_INSTALL_COLLECTION,
      limit: 100,
      cursor,
    })
    for (const record of page.records) {
      const install = parseTileInstall(record.uri, record.value)
      if (install) installs.push(install)
    }
    cursor = page.records.length > 0 ? page.cursor : undefined
  } while (cursor && installs.length < MAX_INSTALLS)
  return installs
}

const tileInstallsQueryKeyRoot = 'tile-installs'
const createTileInstallsQueryKey = (did: string | undefined) =>
  createQueryKey(tileInstallsQueryKeyRoot, {did: did ?? ''})

/**
 * Every install record of the signed-in account. One query for the whole
 * app: the install button of each tile post and the Apps screen read it, and
 * installing or uninstalling edits it in place.
 */
export function useTileInstallsQuery() {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  return useQuery<TileInstall[]>({
    queryKey: createTileInstallsQueryKey(did),
    queryFn: () => fetchTileInstalls(pdsClient, did!),
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * The canonical at-URI of a tile, whatever form the pointer to it took: one
 * written by mu names the repo by DID, one from another client may use a
 * handle, which is resolved. Undefined until it is known.
 */
export function useCanonicalTileUri(
  tile: TileRef | string | undefined,
): AtUriString | undefined {
  const parsed = tile
    ? parseTileUri(typeof tile === 'string' ? tile : tile.uri)
    : undefined
  const isDid = !!parsed?.repo.startsWith('did:')
  const {data: resolved} = useResolveDidQuery(
    parsed && !isDid ? parsed.repo : undefined,
  )
  if (!parsed) return undefined
  const did = isDid ? parsed.repo : resolved
  return did ? canonicalTileUri(did, parsed.rkey) : undefined
}

/** Thrown when the tile being installed has an unverified author. */
export class UntrustedTileInstallError extends Error {
  constructor() {
    super('Only tiles published by verified accounts can be installed')
  }
}

/**
 * Whether the signed-in account has a tile installed, and the two ways to
 * change that. `installed` is undefined until it is known (and signed out).
 *
 * Installing reads the tile's record first, so what is recorded is the
 * record as it stands (repo by DID, current CID) and nothing that is not a
 * tile gets installed; a tile whose author is not verified would never run,
 * so it is refused with `UntrustedTileInstallError`. Uninstalling deletes
 * every install record of the tile, in case two devices each wrote one.
 */
export function useTileInstall(tile: TileRef | string | undefined) {
  const uri = useCanonicalTileUri(tile)
  const queryClient = useQueryClient()
  const pdsClient = usePdsClient()
  const appviewClient = useAppviewClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const queryKey = createTileInstallsQueryKey(did)
  const {data: installs} = useTileInstallsQuery()
  const installed =
    installs && uri ? installs.some(i => i.tile.uri === uri) : undefined

  const install = useMutation<TileInstall, Error, void>({
    mutationFn: async () => {
      if (!did) throw new Error('Not signed in')
      if (!uri) throw new Error('Unknown tile')
      const record = await fetchTileRecord(uri)
      if (!(await fetchIsTrustedTile(queryClient, appviewClient, record.ref))) {
        throw new UntrustedTileInstallError()
      }
      const createdAt = new Date().toISOString()
      const data = await pdsClient.call(com.atproto.repo.createRecord, {
        repo: did,
        collection: TILE_INSTALL_COLLECTION,
        record: {
          $type: TILE_INSTALL_COLLECTION,
          subject: {uri: record.ref.uri, cid: record.ref.cid},
          createdAt,
        },
      })
      return {rkey: new AtUri(data.uri).rkey, tile: record.ref, createdAt}
    },
    onSuccess: created => {
      queryClient.setQueryData<TileInstall[]>(queryKey, old => [
        created,
        ...(old ?? []),
      ])
    },
  })

  const uninstall = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!did) throw new Error('Not signed in')
      const mine = (
        queryClient.getQueryData<TileInstall[]>(queryKey) ?? []
      ).filter(i => i.tile.uri === uri)
      for (const {rkey} of mine) {
        await pdsClient.call(com.atproto.repo.deleteRecord, {
          repo: did,
          collection: TILE_INSTALL_COLLECTION,
          rkey,
        })
      }
    },
    onSuccess: () => {
      queryClient.setQueryData<TileInstall[]>(queryKey, old =>
        (old ?? []).filter(i => i.tile.uri !== uri),
      )
    },
  })

  return {
    uri,
    installed,
    pending: install.isPending || uninstall.isPending,
    install: install.mutateAsync,
    uninstall: uninstall.mutateAsync,
  }
}

/**
 * A tile's record (its manifest, and where its blobs are), cached: what the
 * Apps screen reads the name, icon and screenshot of an installed tile from,
 * and what the page a tile runs on shows while the loader gets going.
 */
export function tileRecordQueryOptions(uri: string | undefined) {
  return queryOptions<TileRecord>({
    queryKey: createQueryKey('tile-record', {uri: uri ?? ''}),
    queryFn: () => fetchTileRecord(uri!),
    enabled: !!uri,
    staleTime: STALE.MINUTES.FIVE,
  })
}

export function useTileRecordQuery(uri: string | undefined) {
  return useQuery(tileRecordQueryOptions(uri))
}
