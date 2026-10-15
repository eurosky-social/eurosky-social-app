/**
 * The AT Protocol collection a tile's MASL manifest is published under. See
 * https://dasl.ing/ and `@dasl/tile-lexicon`.
 */
export const TILE_COLLECTION = 'ing.dasl.masl'

/**
 * Host of the tile loading server (a `@dasl/tile-server`). The loader frames
 * tiles from a fresh random subdomain of it on every load, which is what keeps
 * a tile on an origin of its own, away from mu and from other tiles.
 *
 * webtil.es is a stopgap: mu should run its own loading server on a
 * first-party domain before tiles ship for real.
 */
export const TILES_LOAD_DOMAIN =
  process.env.EXPO_PUBLIC_TILES_LOAD_DOMAIN || 'load.webtil.es'

/**
 * The hosted page that runs one tile for a WebView (`@dasl/tile-host`),
 * which is how tiles play on iOS and Android: the loader needs iframes and a
 * service worker, so native embeds a web page that runs it. Its domain has to
 * be an app-bound domain on iOS (see app.config.js). webtil.es is a stopgap
 * here too.
 */
export const TILES_HOST_URL =
  process.env.EXPO_PUBLIC_TILES_HOST_URL || 'https://webtil.es/host/'

/** Aspect ratio of a rendered tile whose manifest requests no size. */
export const DEFAULT_TILE_ASPECT_RATIO = 16 / 9
export const MIN_TILE_HEIGHT = 200
export const MAX_TILE_HEIGHT = 800
