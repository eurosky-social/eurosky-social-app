import {type MaslSizing, resolveSize, type SizeLimits} from '@dasl/tile-lexicon'

import {
  DEFAULT_TILE_ASPECT_RATIO,
  MAX_TILE_HEIGHT,
  MIN_TILE_HEIGHT,
  TILE_POST_CHROME,
} from './constants'

/**
 * A manifest's `sizing`: the size a tile is designed for, the range it works
 * in, and whether it follows its content. Every part of it is optional.
 */
export type TileSizing = Partial<MaslSizing>

/**
 * mu's limits on a tile's size (https://dasl.ing/tp-size.html), whatever the
 * tile asks for.
 *
 * The width is not negotiable: a tile is exactly as wide as the column it is
 * in, so the minimum and the maximum are both that width.
 *
 * The height has a floor, and a ceiling that depends on the screen: the
 * viewport's height less the post's chrome above and below the tile
 * (`TILE_POST_CHROME`), so that a running tile never pushes the post it is in
 * off screen. `viewportHeight` is the height tiles have to share with that
 * chrome: the window's, less the safe areas on native. Without one the
 * ceiling is `MAX_TILE_HEIGHT`.
 */
export function tileLimits(width: number, viewportHeight?: number): SizeLimits {
  const maxHeight =
    viewportHeight && viewportHeight > 0
      ? Math.max(MIN_TILE_HEIGHT, Math.floor(viewportHeight - TILE_POST_CHROME))
      : MAX_TILE_HEIGHT
  return {
    ...(width > 0 ? {minWidth: width, maxWidth: width} : {}),
    minHeight: MIN_TILE_HEIGHT,
    maxHeight,
  }
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
 * manifest declares, then inside mu's limits (`tileLimits`), which win.
 * Shared by the web frame and the native player so a tile is the same size on
 * both.
 */
export function tileHeight(
  sizing: TileSizing | undefined,
  width: number,
  asked?: number,
  limits: SizeLimits = tileLimits(width),
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
    limits: {minHeight: limits.minHeight, maxHeight: limits.maxHeight},
    fallback: {width: w, height: h},
  }).height
}
