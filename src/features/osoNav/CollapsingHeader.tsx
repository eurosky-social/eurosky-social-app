import {View} from 'react-native'
import Animated from 'react-native-reanimated'

import {atoms as a, useTheme, web} from '#/alf'
import {useCollapsingTitle} from '#/features/newsrooms/hub/useCollapsingTitle'

/**
 * Pins a page header together with anything under it (e.g. feed tabs), and
 * slides the header out of view while scrolling down, back when scrolling up.
 * The same behaviour as the news page; the content under the header stays.
 *
 * Render the header with `sticky={false}`: this block does the pinning.
 * Web only, where the window scrolls.
 */
export function OsoCollapsingHeader({
  header,
  children,
}: {
  header: React.ReactNode
  children?: React.ReactNode
}) {
  const t = useTheme()
  const collapse = useCollapsingTitle()

  return (
    <View pointerEvents="box-none" style={[web([a.sticky, {top: 0}]), a.z_10]}>
      <Animated.View style={[t.atoms.bg, collapse.blockStyle]}>
        <View onLayout={collapse.onTitleLayout}>{header}</View>
        {children}
      </Animated.View>
    </View>
  )
}
