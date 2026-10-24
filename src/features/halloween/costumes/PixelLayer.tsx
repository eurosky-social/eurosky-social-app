import {memo} from 'react'
import {View, type ViewStyle} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {atoms as a} from '#/alf'
import {
  type Costume,
  GRID_SIZE,
  pixelPaths,
} from '#/features/halloween/costumes/model'

/** Shared by the editor, previews, and every avatar; never intercepts input. */
export const PixelLayer = memo(function PixelLayer({
  costume,
  size,
  borderRadius = size / 2,
}: {
  costume: Costume
  size: number
  borderRadius?: ViewStyle['borderRadius']
}) {
  return (
    <View
      testID="costumePixelLayer"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[a.absolute, a.inset_0, a.overflow_hidden, {borderRadius}]}>
      <Svg width={size} height={size} viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}>
        {pixelPaths(costume.pixels, costume.palette).map((d, index) =>
          d ? <Path key={index} d={d} fill={costume.palette[index]} /> : null,
        )}
      </Svg>
    </View>
  )
})
