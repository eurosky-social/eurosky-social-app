import {isInvalidHandle} from '#/lib/strings/handles'
import {TILE_COLLECTION} from './constants'

/**
 * The path of the page a tile runs on by itself, outside any post:
 * `/<author>/app/<rkey>`, the author by handle when there is a good one and
 * by DID otherwise. The route is `TileApp` (`routes.ts`).
 */
export function makeTileAppLink(
  author: {did: string; handle?: string},
  rkey: string,
): string {
  const name =
    author.handle && !isInvalidHandle(author.handle)
      ? author.handle
      : author.did
  return `/${encodeURIComponent(name).replace(/%3A/gi, ':')}/app/${encodeURIComponent(rkey)}`
}

/** The tile a `TileApp` route names: its author (handle or DID) and record key. */
export function tileUriFromAppRoute(name: string, rkey: string): string {
  return `at://${name}/${TILE_COLLECTION}/${rkey}`
}
