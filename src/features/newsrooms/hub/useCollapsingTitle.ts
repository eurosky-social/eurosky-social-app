import {useEffect} from 'react'
import {type LayoutChangeEvent, type NativeScrollEvent} from 'react-native'
import {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {IS_WEB} from '#/env'

/** Scroll travel, in px, that counts as a change of direction. */
const DIRECTION_THRESHOLD = 4

/** How long the title takes to slide in or out. */
const DURATION = 200

/**
 * Slides the hub's title row out of view while the reader scrolls down, and
 * back as soon as they scroll up. The tabs and topic chips pinned under it
 * stay: they are how the hub is navigated, where the title is only a label.
 *
 * The page pins its header block as usual and applies `blockStyle` to it,
 * which moves the whole block up by the title's height; `onTitleLayout`
 * measures that height. On web the window scrolls, so the hook listens to it
 * directly; on native the page forwards its scroll view's events to
 * `onScroll`.
 */
export function useCollapsingTitle() {
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
    if (!IS_WEB) return
    const onWindowScroll = () => update(window.scrollY)
    window.addEventListener('scroll', onWindowScroll, {passive: true})
    return () => window.removeEventListener('scroll', onWindowScroll)
  })

  /** How far the pinned block has moved up; 0 or less. */
  const offset = useDerivedValue(() => -hidden.get() * titleHeight.get())

  const blockStyle = useAnimatedStyle(() => {
    const value = offset.get()
    /*
     * Web moves the pinned block with a transform, which leaves the page's
     * flow alone. Native lays the block out above its scroll view, so it pulls
     * the block up with a margin instead, letting the scroll view grow into
     * the space rather than leaving a gap under the tabs.
     */
    return IS_WEB ? {transform: [{translateY: value}]} : {marginTop: value}
  })

  return {
    blockStyle,
    /** For anything pinned under the block that must follow it up. */
    offset,
    onTitleLayout(event: LayoutChangeEvent) {
      titleHeight.set(event.nativeEvent.layout.height)
    },
    /** For native scroll views; a worklet, so it can go straight to Reanimated. */
    onScroll(event: NativeScrollEvent) {
      'worklet'
      update(event.contentOffset.y)
    },
  }
}
