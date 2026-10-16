import {useState} from 'react'
import {
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {logger} from '#/logger'
import {useAppviewClient} from '#/state/session'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Toast from '#/components/Toast'
import {type app} from '#/lexicons'
import {fetchIsTrustedTile, useTileAuthor} from '../../author'
import {type TileRef} from '../../record'
import {tileHeight, type TileSizing} from '../../sizing'
import {TileCard} from '../TileCard'
import {TilePlayer} from '../TilePlayer'

/**
 * A tile post's embed on iOS and Android: the link card until it is tapped,
 * then the tile, running in a WebView on the hosted page where the
 * screenshot was. See `index.web.tsx` for the web, which runs the loader in
 * the page itself.
 *
 * A tile only plays if its author is one of our verified accounts. The card
 * shows the verdict once it is known, and the tap checks it afresh before the
 * WebView is mounted.
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
  const queryClient = useQueryClient()
  const appviewClient = useAppviewClient()
  const author = useTileAuthor(tile)
  const [checking, setChecking] = useState(false)
  const [active, setActive] = useState(false)
  const [width, setWidth] = useState(0)
  const [sizing, setSizing] = useState<TileSizing | undefined>()
  const title = link.title || l`Tile`

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const activate = async () => {
    if (preview || active || checking) return
    setChecking(true)
    try {
      if (!(await fetchIsTrustedTile(queryClient, appviewClient, tile))) {
        Toast.show(
          l`This tile can't be played here: its author isn't verified.`,
          {type: 'warning'},
        )
        return
      }
      onOpen?.()
      setActive(true)
    } finally {
      setChecking(false)
    }
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
          author={author}
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
        onPress={() => void activate()}
        style={[a.rounded_md]}>
        {({hovered, pressed}) => (
          <TileCard
            link={link}
            author={author}
            hovered={hovered}
            pressed={pressed}
            loading={checking}
            style={style}
          />
        )}
      </Button>
    </View>
  )
}
