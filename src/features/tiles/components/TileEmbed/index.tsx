import {useState} from 'react'
import {
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Toast from '#/components/Toast'
import {type app} from '#/lexicons'
import {type TileRef} from '../../record'
import {tileHeight, type TileSizing} from '../../sizing'
import {TileCard} from '../TileCard'
import {TilePlayer} from '../TilePlayer'

/**
 * A tile post's embed on iOS and Android: the link card until it is tapped,
 * then the tile, running in a WebView on the hosted page where the
 * screenshot was. See `index.web.tsx` for the web, which runs the loader in
 * the page itself.
 */
export function TileEmbed({
  link,
  tile,
  onOpen,
  style,
  preview = false,
}: {
  link: app.bsky.embed.external.ViewExternal
  tile: TileRef
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  /** Composer preview: not interactive. */
  preview?: boolean
}) {
  const {t: l} = useLingui()
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(0)
  const [sizing, setSizing] = useState<TileSizing | undefined>()
  const title = link.title || l`Tile`

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const activate = () => {
    if (preview || active) return
    onOpen?.()
    setActive(true)
  }

  const deactivate = () => {
    setActive(false)
    setSizing(undefined)
  }

  const onError = (message: string) => {
    logger.warn('tiles: could not load tile', {
      safeMessage: message,
      uri: tile.uri,
    })
    Toast.show(l`Could not load this tile.`, {type: 'error'})
    deactivate()
  }

  if (active) {
    return (
      <View style={[a.w_full]} onLayout={onLayout}>
        <TileCard
          link={link}
          style={style}
          media={
            <TilePlayer
              uri={tile.uri}
              height={tileHeight(sizing, width)}
              onSizing={setSizing}
              onError={onError}
            />
          }
          action={
            <Button
              label={l`Close tile`}
              size="tiny"
              shape="round"
              color="secondary"
              onPress={deactivate}>
              <ButtonIcon icon={XIcon} />
            </Button>
          }
        />
      </View>
    )
  }

  return (
    <View style={[a.w_full]} onLayout={onLayout}>
      <Button
        label={l`Play ${title}`}
        onPress={activate}
        style={[a.rounded_md]}>
        {({hovered, pressed}) => (
          <TileCard
            link={link}
            hovered={hovered}
            pressed={pressed}
            style={style}
          />
        )}
      </Button>
    </View>
  )
}
