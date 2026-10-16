import {
  DEFAULT_TILE_ASPECT_RATIO,
  MAX_TILE_HEIGHT,
  MIN_TILE_HEIGHT,
} from './constants'

/** A manifest's requested size (`sizing`), either dimension possibly absent. */
export type TileSizing = {width?: number; height?: number}

/**
 * The height to render a tile at, for a given card width: the manifest's
 * requested size scaled to the width but never shorter than the height it
 * asked for, or its height alone, or the default aspect ratio, within sane
 * bounds. A tile laid out for 520px of height keeps them in a column narrower
 * than the 720 it also asked for, the way the reference loader honours a
 * declared height as is; a wider column grows it in proportion. Shared by the
 * web frame and the native player so a tile is the same size on both.
 */
export function tileHeight(
  sizing: TileSizing | undefined,
  width: number,
): number {
  const w = width || 560
  let h: number
  if (sizing?.width && sizing?.height) {
    h = Math.max((w * sizing.height) / sizing.width, sizing.height)
  } else if (sizing?.height) {
    h = sizing.height
  } else {
    h = w / DEFAULT_TILE_ASPECT_RATIO
  }
  return Math.round(Math.min(MAX_TILE_HEIGHT, Math.max(MIN_TILE_HEIGHT, h)))
}
