import {
  type MaslSizing,
  type StoredMasl,
  type StoredResourceEntry,
} from '@dasl/tile-lexicon'

import {TILES_BLOB_URL} from './constants'

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

/**
 * The CID a link carries, in either form it reaches us in: the raw JSON
 * `{$link}` of a record read straight off the wire, or the `Cid` instance the
 * lex client turns every `{$link}` into when it parses a response. A `Cid`
 * is recognised the way `@atproto/lex-data` itself does it, by its `bytes`;
 * its string form is the same base32 the JSON carried.
 */
function linkCid(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  if ('$link' in value && typeof value.$link === 'string') return value.$link
  if ('bytes' in value && value.bytes instanceof Uint8Array) {
    return (value as {toString(): string}).toString()
  }
  return undefined
}

/**
 * The CID of a resource, however the manifest spells its `src`: a bare
 * cid-link, or a blob ref whose `ref` is the link.
 */
export function tileResourceCid(
  manifest: TileManifest,
  path: string,
): string | undefined {
  const src: unknown = tileResource(manifest, path)?.src
  if (!src || typeof src !== 'object') return undefined
  return linkCid(src) ?? ('ref' in src ? linkCid(src.ref) : undefined)
}

/**
 * The URL of a blob of a repo: on the tile blob CDN when one is configured
 * (`/blob/<did>/<cid>`, which resolves the DID itself; see `services/tiles`),
 * otherwise `getBlob` on the PDS hosting the repo.
 */
export function tileBlobUrl(
  pds: string,
  did: string,
  cid: string,
  cdn: string = TILES_BLOB_URL,
): string {
  if (cdn) {
    // A DID keeps its colons: they are fine in a path, and stay readable.
    const path = `blob/${encodeURIComponent(did).replace(/%3A/gi, ':')}/${encodeURIComponent(cid)}`
    return new URL(path, cdn.endsWith('/') ? cdn : `${cdn}/`).toString()
  }
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
  cdn: string = TILES_BLOB_URL,
): string | undefined {
  const src = manifest.screenshots?.[0]?.src
  if (!src) return undefined
  const cid = tileResourceCid(manifest, src)
  return cid ? tileBlobUrl(pds, did, cid, cdn) : undefined
}

/** The largest side a `sizes` value declares; `any` (a vector) beats them all. */
function declaredIconSize(sizes: string | undefined): number {
  if (!sizes) return 0
  let best = 0
  for (const size of sizes.toLowerCase().split(/\s+/)) {
    if (size === 'any') return Infinity
    const match = /^(\d+)x(\d+)$/.exec(size)
    if (match) best = Math.max(best, Number(match[1]), Number(match[2]))
  }
  return best
}

/**
 * The blob URL of a tile's icon: the biggest one its manifest declares, a
 * monochrome mask only when there is nothing else (it is meant to be tinted,
 * not shown). Undefined when the manifest has no icon among its resources.
 */
export function tileIconUrl(
  manifest: TileManifest,
  pds: string,
  did: string,
  cdn: string = TILES_BLOB_URL,
): string | undefined {
  const icons = [...(manifest.icons ?? [])]
    .filter(icon => typeof icon?.src === 'string')
    .sort((x, y) => {
      const mono =
        Number(x.purpose === 'monochrome') - Number(y.purpose === 'monochrome')
      return mono || declaredIconSize(y.sizes) - declaredIconSize(x.sizes)
    })
  for (const icon of icons) {
    const cid = tileResourceCid(manifest, icon.src)
    if (cid) return tileBlobUrl(pds, did, cid, cdn)
  }
  return undefined
}
