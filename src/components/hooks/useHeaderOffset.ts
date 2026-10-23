import {useState} from 'react'
import {useWindowDimensions} from 'react-native'
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useShellLayout} from '#/state/shell/shell-layout'
import {useBreakpoints} from '#/alf'
import {IS_LIQUID_GLASS, IS_PARTNER_PREVIEW} from '#/env'

export function useHeaderOffset() {
  const {gtMobile} = useBreakpoints()
  const {fontScale} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const {headerHeight} = useShellLayout()
  /*
   * Oso's home header holds feed pills instead of the tab bar the calculation
   * below assumes, so it uses the header's measured height instead.
   */
  const [measuredHeight, setMeasuredHeight] = useState(0)
  useAnimatedReaction(
    () => headerHeight.get(),
    (height, previous) => {
      if (IS_PARTNER_PREVIEW && height !== previous) {
        runOnJS(setMeasuredHeight)(height)
      }
    },
  )
  if (gtMobile) {
    return 0
  }
  if (IS_PARTNER_PREVIEW && measuredHeight > 0) {
    return measuredHeight
  }
  const navBarHeight = 52 + (IS_LIQUID_GLASS ? insets.top : 0)
  const tabBarPad = 10 + 10 + 3 // padding + border
  const normalLineHeight = 20 // matches tab bar
  const tabBarText = normalLineHeight * fontScale
  return navBarHeight + tabBarPad + tabBarText - 4 // for some reason, this calculation is wrong by 4 pixels, which we adjust
}
