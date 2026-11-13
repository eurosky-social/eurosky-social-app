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
 * mu's own (`services/tileLoader`): tile origins are `<random>.t.mu.social`.
 * The default is what a build with no setting uses, the native apps included.
 */
export const TILES_LOAD_DOMAIN =
  process.env.EXPO_PUBLIC_TILES_LOAD_DOMAIN || 'load.t.mu.social'

/**
 * The hosted page that runs one tile for a WebView (`@dasl/tile-host`),
 * which is how tiles play on iOS and Android: the loader needs iframes and a
 * service worker, so native embeds a web page that runs it. Its domain has to
 * be an app-bound domain on iOS (see app.config.js). Served by the loading
 * server's script, next to the origins it loads tiles from.
 */
export const TILES_HOST_URL =
  process.env.EXPO_PUBLIC_TILES_HOST_URL || 'https://t.mu.social/host/'

/**
 * Base URL of the tile blob CDN (`services/tiles`), which serves a tile's
 * resources cached at the edge, keyed on their CIDs, instead of each viewer
 * fetching them from the author's PDS. Unset means mu's CDN; set to an empty
 * string to fetch from the PDS.
 */
export const TILES_BLOB_URL =
  process.env.EXPO_PUBLIC_TILES_BLOB_URL ?? 'https://tiles.mu.social'

/** Aspect ratio of a rendered tile whose manifest requests no size. */
export const DEFAULT_TILE_ASPECT_RATIO = 16 / 9
export const MIN_TILE_HEIGHT = 200
/** The tallest a tile gets when the viewport's height is not known. */
export const MAX_TILE_HEIGHT = 800
/**
 * The room a tile leaves on screen, top and bottom together, so that the post
 * it belongs to still reads as a post with the tile running in it: above the
 * tile, the app's header and the post's author line; below it, the card's
 * footer (title, description, tile author), the post's reply/repost/like row
 * and the app's bottom bar. A tile is never taller than the viewport less
 * this (and the device's safe areas, on native).
 */
export const TILE_POST_CHROME = 340
