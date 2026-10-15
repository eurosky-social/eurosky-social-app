import {type StyleProp, type ViewStyle} from 'react-native'

import {ExternalEmbed} from '#/components/Post/Embed/ExternalEmbed'
import {type app} from '#/lexicons'
import {type TileRef} from '../../record'

/**
 * Tiles only run on the web (the loader needs iframes and a service worker),
 * so on native a tile post shows its link card, which leads to the post on
 * the web, where the tile plays. See `index.web.tsx`.
 */
export function TileEmbed({
  link,
  onOpen,
  style,
}: {
  link: app.bsky.embed.external.ViewExternal
  tile: TileRef
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  /** Composer preview: not interactive. */
  preview?: boolean
}) {
  return <ExternalEmbed link={link} onOpen={onOpen} style={style} hideAlt />
}
