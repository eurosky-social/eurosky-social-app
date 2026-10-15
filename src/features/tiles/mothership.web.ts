import {
  type MaslHeaders,
  maslHTTPHeaders,
  type MaslResponse,
} from '@dasl/tile-lexicon'
import {
  Tile,
  type TileLoader,
  TileMothership,
  type TilePathLoader,
} from '@dasl/tile-loader'

import {TILES_LOAD_DOMAIN} from './constants'
import {isTileUri} from './detect'
import {
  tileBlobUrl,
  type TileManifest,
  tileResource,
  tileResourceCid,
} from './manifest'
import {fetchTileRecord} from './resolve'

const NOT_FOUND: MaslResponse = {
  ok: false,
  status: 404,
  statusText: 'Not found',
}

const HEADER_NAMES = Object.keys(maslHTTPHeaders) as (keyof MaslHeaders)[]

/**
 * Answers a tile's resource requests from the blobs of its record on the
 * author's PDS. This is what `ATPathLoader` in `@dasl/tile-loader/at` does,
 * except that the PDS is already known (that loader only resolves `did:plc`).
 */
class MuTilePathLoader implements TilePathLoader {
  #pds: string
  #did: string
  #manifest: TileManifest

  constructor(pds: string, did: string, manifest: TileManifest) {
    this.#pds = pds
    this.#did = did
    this.#manifest = manifest
  }

  async resolvePath(path: string): Promise<MaslResponse> {
    const entry = tileResource(this.#manifest, path)
    const cid = tileResourceCid(this.#manifest, path)
    if (!entry || !cid) return NOT_FOUND
    const res = await fetch(tileBlobUrl(this.#pds, this.#did, cid))
    if (!res.ok) return NOT_FOUND
    const headers: MaslHeaders = {}
    for (const name of HEADER_NAMES) {
      const value = entry[name]
      if (typeof value === 'string') headers[name] = value
    }
    return {
      ok: true,
      status: 200,
      statusText: 'Ok',
      headers,
      body: await res.arrayBuffer(),
    }
  }
}

/** Loads `at://…/ing.dasl.masl/…` tiles, resolving handles and any DID method. */
class MuTileLoader implements TileLoader {
  async load(url: string, mothership: TileMothership) {
    if (!isTileUri(url)) return false
    const record = await fetchTileRecord(url)
    return new Tile(
      mothership,
      record.ref.uri,
      record.manifest,
      new MuTilePathLoader(record.pds, record.did, record.manifest),
    )
  }
}

let mothership: TileMothership | undefined

/**
 * The page's one tile mothership. It frames every tile from a fresh origin on
 * `TILES_LOAD_DOMAIN` and stamps every response a tile receives with the tile
 * policy from `@dasl/tile-lexicon`.
 */
export function getTileMothership(): TileMothership {
  if (!mothership) {
    mothership = new TileMothership({loadDomain: TILES_LOAD_DOMAIN})
    mothership.init()
    mothership.addLoader(new MuTileLoader())
  }
  return mothership
}
