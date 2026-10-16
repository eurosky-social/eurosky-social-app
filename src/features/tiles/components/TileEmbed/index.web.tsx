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
import {tileHeight, type TileSizing} from '../../sizing'
import {TileCard} from '../TileCard'

type Status = 'card' | 'loading' | 'active'

/**
 * How far the embed sits in from the edges of the post it belongs to: the
 * avatar column on the left, the post's padding on both sides. A running
 * tile is given the whole post, so these are what it has to cancel out.
 */
type Inset = {left: number; right: number}

/*
 * The posts a running tile may spread across, by the test ids upstream puts
 * on them: a feed item, and a thread post (the anchor included).
 */
const POST_SELECTOR =
  '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"]'

/**
 * Measures where the embed sits inside its post. Undefined when it is not
 * in one (a DM, a preview), or already fills it; the tile then keeps its
 * column. On the web a View's ref is its DOM element.
 */
function measureInset(node: unknown): Inset | undefined {
  const el = node as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return undefined
  const post = el.closest(POST_SELECTOR)
  if (!post) return undefined
  const own = el.getBoundingClientRect()
  const outer = post.getBoundingClientRect()
  const left = Math.round(own.left - outer.left)
  const right = Math.round(outer.right - own.right)
  if (left < 0 || right < 0 || left + right === 0) return undefined
  return {left, right}
}

/**
 * A tile post's embed: the link card until it is clicked, then the tile
 * itself, running in its sandboxed frame where the screenshot was. The card
 * never follows its link; on mu the post is where the tile plays.
 *
 * A tile only plays if its author is one of our verified accounts. The card
 * shows the verdict once it is known, and the click checks it afresh before
 * anything of the tile is loaded.
 *
 * A running tile spreads to the edges of its post (`fullWidth`): the card's
 * margins inside the post are measured when it is opened and cancelled out,
 * so the frame runs flush from edge to edge and its height follows the
 * manifest's sizing at that width.
 *
 * Opened from a link that asks for it (`autoplay`, from `?tile=activate` on
 * the post's URL), the tile loads straight away, with no card to click.
 */
export function TileEmbed({
  link,
  tile,
  onOpen,
  style,
  preview = false,
  fullWidth = false,
  autoplay = false,
}: {
  link: app.bsky.embed.external.ViewExternal
  tile: TileRef
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  /** Composer preview: not interactive. */
  preview?: boolean
  /** Whether a running tile may spread to the edges of the post it is in. */
  fullWidth?: boolean
  /** Load the tile on mount instead of waiting for a click. */
  autoplay?: boolean
}) {
  const {t: l} = useLingui()
  const queryClient = useQueryClient()
  const appviewClient = useAppviewClient()
  const author = useTileAuthor(tile)
  const [status, setStatus] = useState<Status>(
    autoplay && !preview ? 'loading' : 'card',
  )
  const [width, setWidth] = useState(0)
  const [sizing, setSizing] = useState<TileSizing | undefined>()
  const [inset, setInset] = useState<Inset | undefined>()
  const busyRef = useRef(false)
  const rootRef = useRef<React.ComponentRef<typeof View>>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef<Tile | null>(null)
  const title = link.title || l`Tile`
  const height = tileHeight(sizing, width)

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const activate = async () => {
    if (preview || status === 'active' || busyRef.current) return
    busyRef.current = true
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
      setSizing(loaded.manifest.sizing)
      setInset(fullWidth ? measureInset(rootRef.current) : undefined)
      setStatus('active')
    } catch (e) {
      logger.warn('tiles: could not load tile', {
        safeMessage: e,
        uri: tile.uri,
      })
      Toast.show(l`Could not load this tile.`, {type: 'error'})
      setStatus('card')
    } finally {
      busyRef.current = false
    }
  }

  /*
   * The latest `activate` sits in a ref so the autoplay effect can call it
   * without rerunning on every render.
   */
  const activateRef = useRef(activate)
  useEffect(() => {
    activateRef.current = activate
  })
  const autoplayedRef = useRef(false)
  useEffect(() => {
    if (!autoplay || preview || autoplayedRef.current) return
    autoplayedRef.current = true
    void activateRef.current()
  }, [autoplay, preview])

  const deactivate = () => {
    loadedRef.current = null
    setSizing(undefined)
    setInset(undefined)
    setStatus('card')
  }

  /*
   * The loader hands back a DOM iframe (the shuttle, on its own origin), so
   * it is mounted into a plain div once the card has switched to its active
   * layout. The frame fills that div, whose height React keeps in step with
   * the width, so a resize never remounts (and so reloads) the tile.
   * Removing the frame tears the tile down.
   */
  useEffect(() => {
    const host = hostRef.current
    const loaded = loadedRef.current
    if (status !== 'active' || !host || !loaded) return
    const frame = loaded.renderContent()
    frame.style.height = '100%'
    frame.title = title
    host.replaceChildren(frame)
    return () => {
      frame.remove()
    }
  }, [status, title])

  if (status === 'active') {
    const spread = inset && {
      marginLeft: -inset.left,
      marginRight: -inset.right,
    }
    return (
      <View
        ref={rootRef}
        style={[spread ? spread : a.w_full]}
        onLayout={onLayout}>
        <TileCard
          link={link}
          author={author}
          style={style}
          flush={!!spread}
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
    <View ref={rootRef} style={[a.w_full]} onLayout={onLayout}>
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
