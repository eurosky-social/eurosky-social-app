import {useEffect, useRef, useState} from 'react'
import {
  type LayoutChangeEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {type Tile} from '@dasl/tile-loader'
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
import {getTileMothership} from '../../mothership'
import {type TileRef} from '../../record'
import {tileHeight} from '../../sizing'
import {TileCard} from '../TileCard'

type Status = 'card' | 'loading' | 'active'

/**
 * A tile post's embed: the link card until it is clicked, then the tile
 * itself, running in its sandboxed frame where the screenshot was. The card
 * never follows its link; on mu the post is where the tile plays.
 *
 * A tile only plays if its author is one of our verified accounts. The card
 * shows the verdict once it is known, and the click checks it afresh before
 * anything of the tile is loaded.
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
  const [status, setStatus] = useState<Status>('card')
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef<Tile | null>(null)
  const title = link.title || l`Tile`

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const activate = async () => {
    if (preview || status !== 'card') return
    setStatus('loading')
    try {
      if (!(await fetchIsTrustedTile(queryClient, appviewClient, tile))) {
        Toast.show(
          l`This tile can't be played here: its author isn't verified.`,
          {type: 'warning'},
        )
        setStatus('card')
        return
      }
      onOpen?.()
      const loaded = await getTileMothership().loadTile(tile.uri)
      if (!loaded) throw new Error(`No loader matched ${tile.uri}`)
      loadedRef.current = loaded
      setHeight(tileHeight(loaded.manifest.sizing, width))
      setStatus('active')
    } catch (e) {
      logger.warn('tiles: could not load tile', {
        safeMessage: e,
        uri: tile.uri,
      })
      Toast.show(l`Could not load this tile.`, {type: 'error'})
      setStatus('card')
    }
  }

  const deactivate = () => {
    loadedRef.current = null
    setStatus('card')
  }

  /*
   * The loader hands back a DOM iframe (the shuttle, on its own origin), so
   * it is mounted into a plain div once the card has switched to its active
   * layout. Removing the frame tears the tile down.
   */
  useEffect(() => {
    const host = hostRef.current
    const loaded = loadedRef.current
    if (status !== 'active' || !host || !loaded) return
    const frame = loaded.renderContent(height)
    frame.title = title
    host.replaceChildren(frame)
    return () => {
      frame.remove()
    }
  }, [status, height, title])

  if (status === 'active') {
    return (
      <View style={[a.w_full]} onLayout={onLayout}>
        <TileCard
          link={link}
          author={author}
          style={style}
          media={<div ref={hostRef} style={{width: '100%', height}} />}
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
            loading={status === 'loading'}
            style={style}
          />
        )}
      </Button>
    </View>
  )
}
