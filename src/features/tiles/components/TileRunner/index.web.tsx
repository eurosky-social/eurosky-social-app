import {useEffect, useRef, useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {type Tile} from '@dasl/tile-loader'

import {atoms as a} from '#/alf'
import {Loader} from '#/components/Loader'
import {TILE_APP_CHROME} from '../../constants'
import {getTileMothership} from '../../mothership'
import {tileHeight, tileLimits} from '../../sizing'
import {TileFrame} from '../TileFrame'

/**
 * A tile running by itself, outside any post: the page of an installed tile
 * (`screens/TileAppScreen.tsx`). It loads the tile and frames it across the
 * column it is given, at the height the tile's manifest and its requests
 * over the size protocol come to, within what the window leaves once the
 * page's own chrome is counted.
 *
 * Whether the tile may run at all (tiles are not paused, its author is
 * verified) is the caller's to settle before mounting this. Give it a `key`
 * per tile: it loads the one it was mounted with.
 */
export function TileRunner({
  uri,
  title,
  onError,
}: {
  uri: string
  /** The frame's accessible name. */
  title: string
  onError: (message: string) => void
}) {
  const [loaded, setLoaded] = useState<Tile | null>(null)
  const [width, setWidth] = useState(0)
  // The height the running tile last asked for, over the size protocol.
  const [asked, setAsked] = useState<number | undefined>()
  const {height: viewportHeight} = useWindowDimensions()
  const limits = tileLimits(width, viewportHeight, TILE_APP_CHROME)
  const height = tileHeight(loaded?.manifest.sizing, width, asked, limits)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    let live = true
    getTileMothership()
      .loadTile(uri)
      .then(tile => {
        if (!live) return
        if (!tile) throw new Error(`No loader matched ${uri}`)
        setLoaded(tile)
      })
      .catch((e: unknown) => {
        if (live) onErrorRef.current(e instanceof Error ? e.message : String(e))
      })
    return () => {
      live = false
    }
  }, [uri])

  return (
    <View
      style={[a.w_full]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {loaded && width > 0 ? (
        <TileFrame
          tile={loaded}
          title={title}
          height={height}
          limits={limits}
          onAsk={setAsked}
        />
      ) : (
        <View style={[a.align_center, a.justify_center, {height}]}>
          <Loader size="xl" />
        </View>
      )}
    </View>
  )
}
