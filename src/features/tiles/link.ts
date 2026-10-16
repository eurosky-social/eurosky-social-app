/**
 * The query parameter a tile card's link carries, so that following the link
 * to the post on mu opens it with the tile already loading rather than
 * behind its card. `TileAutoplayProvider` (autoplay.tsx) is what honours it.
 */
export const TILE_ACTIVATE_PARAM = 'tile'
export const TILE_ACTIVATE_VALUE = 'activate'

/** The post's own URL, as a tile card links to it. */
export function tilePostUrl(postUrl: string): string {
  const url = new URL(postUrl)
  url.searchParams.set(TILE_ACTIVATE_PARAM, TILE_ACTIVATE_VALUE)
  return url.toString()
}

/** Whether a route's `tile` param (a web query param, so anything) asks for it. */
export function isTileActivation(value: unknown): boolean {
  return value === TILE_ACTIVATE_VALUE
}
