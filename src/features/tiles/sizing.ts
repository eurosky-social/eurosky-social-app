import {type MaslSizing, resolveSize} from '@dasl/tile-lexicon'

import {
  DEFAULT_TILE_ASPECT_RATIO,
  MAX_TILE_HEIGHT,
  MIN_TILE_HEIGHT,
} from './constants'

/**
 * A manifest's `sizing`: the size a tile is designed for, the range it works
 * in, and whether it follows its content. Every part of it is optional.
 */
export type TileSizing = Partial<MaslSizing>

/** mu's limits on a tile's height, whatever the tile asks for. */
export const TILE_LIMITS = {
  minHeight: MIN_TILE_HEIGHT,
  maxHeight: MAX_TILE_HEIGHT,
}

/**
 * The height to render a tile at, for a given card width.
 *
 * To start with it is the manifest's requested size scaled to the width but
 * never shorter than the height it asked for, or its height alone, or the
 * default aspect ratio. A tile laid out for 520px of height keeps them in a
 * column narrower than the 720 it also asked for, the way the reference
 * loader honours a declared height as is; a wider column grows it in
 * proportion.
 *
 * Once the tile has asked for a height over the size protocol (`asked`: its
 * own request, or its content's height when its manifest declares `fit`),
 * that is what it gets instead.
 *
 * Either way the result is settled by the rules every tile context shares
 * (`resolveSize`, https://dasl.ing/tp-size.html): inside the range the
 * manifest declares, then inside mu's limits, which win. Shared by the web
 * frame and the native player so a tile is the same size on both.
 */
export function tileHeight(
  sizing: TileSizing | undefined,
  width: number,
  asked?: number,
): number {
  const w = width || 560
  let h: number
  if (asked && asked > 0) {
    h = asked
  } else if (sizing?.width && sizing?.height) {
    h = Math.max((w * sizing.height) / sizing.width, sizing.height)
  } else if (sizing?.height) {
    h = sizing.height
  } else {
    h = w / DEFAULT_TILE_ASPECT_RATIO
  }
  return resolveSize({
    want: {height: h},
    sizing: {minHeight: sizing?.minHeight, maxHeight: sizing?.maxHeight},
    limits: TILE_LIMITS,
    fallback: {width: w, height: h},
  }).height
}
