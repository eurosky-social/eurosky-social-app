import {useEffect, useRef, useState} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {WebView, type WebViewMessageEvent} from 'react-native-webview'
import {type ShouldStartLoadRequest} from 'react-native-webview/lib/WebViewTypes'
import {parseTileHostEvent, type TileHostLimits} from '@dasl/tile-host/messages'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {atoms as a} from '#/alf'
import {Loader} from '#/components/Loader'
import {tileHostLimitsMessage, tileHostOrigin, tileHostUrl} from '../host'
import {type TileSizing} from '../sizing'

/**
 * A tile running on native: a WebView on the hosted page (`@dasl/tile-host`)
 * that runs the loader, sandbox and all. The page reports the manifest's
 * requested size, the sizes the tile asks for as it runs, readiness and
 * errors over the message bridge, and is told mu's limits on the tile's size;
 * nothing else crosses it.
 */
export function TilePlayer({
  uri,
  height,
  limits,
  onSizing,
  onSize,
  onLoad,
  onError,
  style,
}: {
  uri: string
  height: number
  /**
   * mu's limits on the tile's size (`tileLimits`). The page is told them, as
   * soon as it is up and whenever they change, and passes them on to the tile.
   */
  limits?: TileHostLimits
  /** The manifest's requested size, once known. */
  onSizing?: (sizing: TileSizing | undefined) => void
  /**
   * The running tile asks for a size (https://dasl.ing/tp-size.html), in CSS
   * pixels, either dimension possibly absent. The parent decides the height
   * and passes it back as `height`; the page tells the tile what it got.
   */
  onSize?: (want: {width?: number; height?: number}) => void
  onLoad?: () => void
  onError?: (message: string) => void
  style?: StyleProp<ViewStyle>
}) {
  const openLink = useOpenLink()
  const [ready, setReady] = useState(false)
  const source = tileHostUrl(uri)
  const hostOrigin = tileHostOrigin()
  /*
   * `WebView<P>` is `Component<WebViewProps & P>` with P undefined by default,
   * which leaves it no props at all once a ref pins P: hence the `object`.
   */
  const webViewRef = useRef<WebView<object>>(null)
  /*
   * The page listens from the moment its script runs, and announces itself
   * with `manifest`, its first message: nothing is sent before that. The
   * message is a string so that the effect only runs when a limit changes.
   */
  const [listening, setListening] = useState(false)
  const limitsMessage = limits ? tileHostLimitsMessage(limits) : undefined
  useEffect(() => {
    if (!listening || !limitsMessage) return
    webViewRef.current?.postMessage(limitsMessage)
  }, [listening, limitsMessage])

  const onMessage = (e: WebViewMessageEvent) => {
    const event = parseTileHostEvent(e.nativeEvent.data)
    if (!event) return
    switch (event.event) {
      case 'manifest':
        setListening(true)
        onSizing?.(event.sizing)
        break
      case 'size':
        onSize?.({width: event.width, height: event.height})
        break
      case 'load':
        setReady(true)
        onLoad?.()
        break
      case 'error':
        onError?.(event.message)
        break
      default:
        // title and protocol messages: nothing to do with them yet.
        break
    }
  }

  /*
   * Only the host page belongs in the top frame. The shuttle and the tile are
   * subframes and are left alone; a top-level navigation anywhere else is a
   * link the tile opened out of its sandbox, which goes where links go.
   */
  const onShouldStartLoadWithRequest = (req: ShouldStartLoadRequest) => {
    if (!req.isTopFrame) return true
    if (req.url.startsWith(hostOrigin)) return true
    openLink(req.url)
    return false
  }

  return (
    <View style={[a.w_full, {height}, style]}>
      <WebView
        ref={webViewRef}
        source={{uri: source}}
        style={[a.flex_1, a.bg_transparent]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onOpenWindow={e => openLink(e.nativeEvent.targetUrl)}
        setSupportMultipleWindows
        /*
         * iOS only gives service workers, which the tile runtime needs, to
         * app-bound domains; the host's domain is listed in app.config.js.
         */
        limitsNavigationsToAppBoundDomains
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        bounces={false}
        nestedScrollEnabled
        pullToRefreshEnabled={false}
        webviewDebuggingEnabled={__DEV__}
        onError={e => onError?.(e.nativeEvent.description)}
        onHttpError={e =>
          onError?.(`${e.nativeEvent.statusCode} from ${e.nativeEvent.url}`)
        }
      />
      {!ready && (
        <View
          pointerEvents="none"
          style={[
            a.align_center,
            a.justify_center,
            {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
          ]}>
          <Loader size="xl" />
        </View>
      )}
    </View>
  )
}
