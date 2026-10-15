import {
  type MaslSizing,
  type StoredMasl,
  type StoredResourceEntry,
} from '@dasl/tile-lexicon'

/** A tile's MASL manifest as stored in its AT record. */
export type TileManifest = StoredMasl

export type TileSizing = MaslSizing

/** The resource entry for a path, tolerating a missing or extra leading slash. */
export function tileResource(
  manifest: TileManifest,
  path: string,
): StoredResourceEntry | undefined {
  const resources = manifest.resources
  if (!resources) return undefined
  const alt = path.startsWith('/') ? path.slice(1) : `/${path}`
  return resources[path] ?? resources[alt]
}

/** The CID of a resource, however the manifest spells its `src`. */
export function tileResourceCid(
  manifest: TileManifest,
  path: string,
): string | undefined {
  const src = tileResource(manifest, path)?.src
  if (!src || typeof src !== 'object') return undefined
  if ('$link' in src && typeof src.$link === 'string') return src.$link
  if ('ref' in src && src.ref && typeof src.ref.$link === 'string') {
    return src.ref.$link
  }
  return undefined
}

/** The URL of a blob on the PDS hosting a repo. */
export function tileBlobUrl(pds: string, did: string, cid: string): string {
  const url = new URL('/xrpc/com.atproto.sync.getBlob', pds)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid)
  return url.toString()
}

/** The blob URL of a tile's first screenshot, which the card uses. */
export function tileScreenshotUrl(
  manifest: TileManifest,
  pds: string,
  did: string,
): string | undefined {
  const src = manifest.screenshots?.[0]?.src
  if (!src) return undefined
  const cid = tileResourceCid(manifest, src)
  return cid ? tileBlobUrl(pds, did, cid) : undefined
}
