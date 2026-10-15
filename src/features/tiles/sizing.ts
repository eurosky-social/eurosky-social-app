import {
  DEFAULT_TILE_ASPECT_RATIO,
  MAX_TILE_HEIGHT,
  MIN_TILE_HEIGHT,
} from './constants'

/** A manifest's requested size (`sizing`), either dimension possibly absent. */
export type TileSizing = {width?: number; height?: number}

/**
 * The height to render a tile at, for a given card width: the manifest's
 * requested size scaled to the width, or its height alone, or the default
 * aspect ratio, within sane bounds. Shared by the web frame and the native
 * player so a tile is the same size on both.
 */
export function tileHeight(
  sizing: TileSizing | undefined,
  width: number,
): number {
  const w = width || 560
  let h: number
  if (sizing?.width && sizing?.height) {
    h = (w * sizing.height) / sizing.width
  } else if (sizing?.height) {
    h = sizing.height
  } else {
    h = w / DEFAULT_TILE_ASPECT_RATIO
  }
  return Math.round(Math.min(MAX_TILE_HEIGHT, Math.max(MIN_TILE_HEIGHT, h)))
}
