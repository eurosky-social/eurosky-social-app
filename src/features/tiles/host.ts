import {
  type TileHostCommand,
  type TileHostLimits,
} from '@dasl/tile-host/messages'

import {TILES_HOST_URL, TILES_LOAD_DOMAIN} from './constants'

/**
 * The URL of the hosted page that runs a tile, for the native player. The
 * page defaults its loading server to `load.<its own host>`, so ours is only
 * passed along when it differs.
 */
export function tileHostUrl(
  tileUri: string,
  {
    hostUrl = TILES_HOST_URL,
    loadDomain = TILES_LOAD_DOMAIN,
  }: {hostUrl?: string; loadDomain?: string} = {},
): string {
  const url = new URL(hostUrl)
  url.searchParams.set('tile', tileUri)
  if (loadDomain !== `load.${url.host}`) {
    url.searchParams.set('load', loadDomain)
  }
  return url.toString()
}

/**
 * The message that tells the hosted page mu's limits on the tile's size
 * (`tileLimits`), for `WebView.postMessage`. The page passes them on to the
 * tile, which is then answered with the limits it really has rather than the
 * page's defaults. They are sent whole: a limit left out is a limit lifted.
 */
export function tileHostLimitsMessage(limits: TileHostLimits): string {
  const command: TileHostCommand = {tilesHost: 1, action: 'limits'}
  for (const k of ['minWidth', 'minHeight', 'maxWidth', 'maxHeight'] as const) {
    const v = limits[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) command[k] = v
  }
  return JSON.stringify(command)
}

/** The origin of the host page: the only thing allowed in the player's top frame. */
export function tileHostOrigin(hostUrl: string = TILES_HOST_URL): string {
  return new URL(hostUrl).origin
}

/**
 * Whether a URL is on the host page's origin. The two are compared as the URL
 * parser reads them: by its text alone, a host that merely starts like ours
 * would pass for it. A URL that does not parse is not on it, and neither is
 * one with no origin of its own (`about:blank`, `data:`): the parser calls
 * every such origin `null`, and two of those are not the same place.
 */
export function isOnTileHostOrigin(
  url: string,
  hostOrigin: string = tileHostOrigin(),
): boolean {
  try {
    const origin = new URL(url).origin
    return origin !== 'null' && origin === hostOrigin
  } catch {
    return false
  }
}
