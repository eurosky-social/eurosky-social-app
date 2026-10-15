import {type TileMothership} from '@dasl/tile-loader'

/**
 * Tiles only run on the web: the loader needs iframes and a service worker.
 * See `mothership.web.ts`.
 */
export function getTileMothership(): TileMothership {
  throw new Error('Tiles can only be rendered on the web')
}
