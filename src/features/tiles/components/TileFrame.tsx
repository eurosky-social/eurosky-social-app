import {type SizeLimits} from '@dasl/tile-lexicon'
import {type Tile} from '@dasl/tile-loader'

/**
 * Tiles only run in the page on the web: the loader needs iframes and a
 * service worker. See `TileFrame.web.tsx`; native runs a tile in
 * `TilePlayer`.
 */
export function TileFrame(_props: {
  tile: Tile
  title: string
  height: number
  limits: SizeLimits
  onAsk: (height: number) => void
}): React.ReactNode {
  throw new Error('Tiles can only be rendered in the page on the web')
}
