import {useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {atoms as a} from '#/alf'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import {TILE_APP_CHROME} from '../../constants'
import {tileHeight, tileLimits, type TileSizing} from '../../sizing'
import {TilePlayer} from '../TilePlayer'

/**
 * A tile running by itself, outside any post, on iOS and Android: the page
 * of an installed tile (`screens/TileAppScreen.tsx`), in a WebView on the
 * hosted page. See `index.web.tsx` for the web, which runs the loader in the
 * page itself.
 *
 * Whether the tile may run at all is the caller's to settle before mounting
 * this. Give it a `key` per tile.
 */
export function TileRunner({
  uri,
  title: _title,
  onError,
}: {
  uri: string
  /** The frame's accessible name on the web; the hosted page names its own. */
  title: string
  onError: (message: string) => void
}) {
  const {linkWarningDialogControl} = useGlobalDialogsControlContext()
  const [width, setWidth] = useState(0)
  const [sizing, setSizing] = useState<TileSizing | undefined>()
  // The height the running tile last asked for, over the size protocol.
  const [asked, setAsked] = useState<number | undefined>()
  const {height: windowHeight} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const limits = tileLimits(
    width,
    windowHeight - insets.top - insets.bottom,
    TILE_APP_CHROME,
  )

  return (
    <View
      style={[a.w_full]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <TilePlayer
        uri={uri}
        height={tileHeight(sizing, width, asked, limits)}
        limits={limits}
        onSizing={setSizing}
        onSize={want => {
          if (want.height) setAsked(want.height)
        }}
        onLink={(href, activated) => {
          /*
           * A link out of the tile is ours to open, or not: the user sees
           * the address first, in the dialog mu shows for any link it does
           * not vouch for. A request nobody tapped for is dropped.
           */
          if (activated) {
            linkWarningDialogControl.open({displayText: '', href})
          }
        }}
        onError={onError}
      />
    </View>
  )
}
