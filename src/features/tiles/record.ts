import {type AtUriString} from '@atproto/syntax'

import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {isTileUri} from './detect'

/**
 * A pointer from a link card to the tile it stands for: the at-URI of the
 * `ing.dasl.masl` record and, when known, the CID of that record at posting
 * time (a strongRef, so a renderer can tell when the tile has since been
 * republished).
 */
export type TileRef = {
  uri: AtUriString
  cid?: string
}

/**
 * An `app.bsky.embed.external#external` extended with the tile pointer. The
 * card is an ordinary link card to the post itself on mu, so every client
 * shows something sensible; mu reads `tile` and activates the tile in place.
 *
 * Lexicon objects admit unknown fields, so the PDS stores this as is, but the
 * appview's `#viewExternal` only carries the fields it knows: renderers read
 * the pointer from the post record (`PostView.record`), never from the view.
 */
export type TileExternal = app.bsky.embed.external.External & {
  tile?: TileRef
}

function asTileRef(value: unknown): TileRef | undefined {
  if (!value || typeof value !== 'object') return undefined
  const {uri, cid} = value as {uri?: unknown; cid?: unknown}
  if (typeof uri !== 'string' || !isTileUri(uri)) return undefined
  return {
    uri: uri as AtUriString,
    cid: typeof cid === 'string' ? cid : undefined,
  }
}

/** The tile pointer in a post record's embed, if it carries one. */
export function getTileRefFromRecordEmbed(embed: unknown): TileRef | undefined {
  let external: unknown
  if (bsky.isType(app.bsky.embed.external, embed)) {
    external = embed.external
  } else if (
    bsky.isType(app.bsky.embed.recordWithMedia, embed) &&
    bsky.isType(app.bsky.embed.external, embed.media)
  ) {
    external = embed.media.external
  }
  if (!external || typeof external !== 'object') return undefined
  return asTileRef((external as TileExternal).tile)
}

/** The tile pointer of a post, read from its record. */
export function getTileRef(
  post: app.bsky.feed.defs.PostView | undefined,
): TileRef | undefined {
  if (!post || !bsky.isType(app.bsky.feed.post, post.record)) return undefined
  return getTileRefFromRecordEmbed(post.record.embed)
}
