import {type AtIdentifierString} from '@atproto/syntax'

import {createServiceClient} from '#/lib/lexClient'
import {type ComposerImage} from '#/state/gallery'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {com} from '#/lexicons'
import {TILE_COLLECTION} from './constants'
import {parseTileUri} from './detect'
import {type TileManifest, tileScreenshotUrl} from './manifest'
import {type TileRef} from './record'
import {makeTileThumb} from './thumb'

export type TileRecord = {
  /** Canonical pointer: the repo as a DID, plus the record CID. */
  ref: TileRef
  did: string
  pds: string
  manifest: TileManifest
}

export class NotATileError extends Error {
  constructor(uri: string) {
    super(`Not a tile: ${uri}`)
  }
}

/**
 * Reads a tile record from its author's PDS. The repo in the URI may be a
 * handle; a PDS only serves `getRecord` for repos it hosts, so the author's
 * DID and PDS are resolved first and the read goes to an unauthenticated
 * client pointed there.
 */
export async function fetchTileRecord(uri: string): Promise<TileRecord> {
  const parsed = parseTileUri(uri)
  if (!parsed) throw new NotATileError(uri)
  const {did, pds} = await resolveDidAndPds(parsed.repo)
  const client = createServiceClient(pds)
  const record = await client.call(com.atproto.repo.getRecord, {
    repo: did as AtIdentifierString,
    collection: TILE_COLLECTION,
    rkey: parsed.rkey,
  })
  const manifest = (record.value as {tile?: TileManifest} | undefined)?.tile
  if (!manifest || typeof manifest !== 'object' || !manifest.resources) {
    throw new NotATileError(uri)
  }
  return {
    ref: {uri: record.uri, cid: record.cid},
    did,
    pds,
    manifest,
  }
}

export type ResolvedTile = TileRecord & {
  title: string
  description: string
  thumb: ComposerImage | undefined
}

/** A tile with the material for its card: name, description, screenshot. */
export async function resolveTile(uri: string): Promise<ResolvedTile> {
  const tile = await fetchTileRecord(uri)
  const screenshotUrl = tileScreenshotUrl(tile.manifest, tile.pds, tile.did)
  return {
    ...tile,
    title: tile.manifest.name ?? '',
    description: tile.manifest.description ?? '',
    thumb: screenshotUrl ? await makeTileThumb(screenshotUrl) : undefined,
  }
}
