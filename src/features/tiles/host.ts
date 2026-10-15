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

/** The origin of the host page: the only thing allowed in the player's top frame. */
export function tileHostOrigin(hostUrl: string = TILES_HOST_URL): string {
  return new URL(hostUrl).origin
}
