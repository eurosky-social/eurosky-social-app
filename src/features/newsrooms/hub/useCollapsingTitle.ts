import {useEffect} from 'react'
import {type LayoutChangeEvent, type NativeScrollEvent} from 'react-native'
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {useBreakpoints} from '#/alf'
import {IS_WEB} from '#/env'

/** Scroll travel, in px, that counts as a change of direction. */
const DIRECTION_THRESHOLD = 4

/** How long the title takes to slide in or out. */
const DURATION = 200

/**
 * Slides the hub's title row out of view while the reader scrolls down, and
 * back as soon as they scroll up, on phones. The tabs and topic chips pinned
 * under it stay: they are how the hub is navigated, where the title is only a
 * label, and three pinned rows is a lot of a phone's screen.
 *
 * The page pins its header block as usual and applies `blockStyle` to it,
 * which moves the whole block up by the title's height; `onTitleLayout`
 * measures that height. On web the window scrolls, so the hook listens to it
 * directly; on native the page forwards its scroll view's events to
 * `onScroll`.
 */
export function useCollapsingTitle() {
  const {gtMobile} = useBreakpoints()
  const enabled = !gtMobile
  const titleHeight = useSharedValue(0)
  /** 0 with the title shown, 1 with it hidden. */
  const hidden = useSharedValue(0)
  const lastY = useSharedValue(0)

  function update(rawY: number) {
    'worklet'
    const y = Math.max(0, rawY)
    const dy = y - lastY.get()
    lastY.set(y)
    let next = hidden.get()
    if (y <= titleHeight.get()) next = 0
    else if (dy > DIRECTION_THRESHOLD) next = 1
    else if (dy < -DIRECTION_THRESHOLD) next = 0
    else return
    if (next !== hidden.get()) {
      hidden.set(withTiming(next, {duration: DURATION}))
    }
  }

  useEffect(() => {
    if (!IS_WEB || !enabled) return
    const onWindowScroll = () => update(window.scrollY)
    window.addEventListener('scroll', onWindowScroll, {passive: true})
    return () => window.removeEventListener('scroll', onWindowScroll)
  })

  useEffect(() => {
    if (!enabled) hidden.set(0)
  }, [enabled, hidden])

  const blockStyle = useAnimatedStyle(() => {
    const offset = -hidden.get() * titleHeight.get()
    /*
     * Web moves the pinned block with a transform, which leaves the page's
     * flow alone. Native lays the block out above its scroll view, so it pulls
     * the block up with a margin instead, letting the scroll view grow into
     * the space rather than leaving a gap under the tabs.
     */
    return IS_WEB ? {transform: [{translateY: offset}]} : {marginTop: offset}
  })

  return {
    blockStyle,
    onTitleLayout(event: LayoutChangeEvent) {
      titleHeight.set(event.nativeEvent.layout.height)
    },
    /** For native scroll views; a worklet, so it can go straight to Reanimated. */
    onScroll(event: NativeScrollEvent) {
      'worklet'
      if (enabled) update(event.contentOffset.y)
    },
  }
}
