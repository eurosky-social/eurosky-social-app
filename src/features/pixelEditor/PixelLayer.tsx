import {memo} from 'react'
import {View, type ViewStyle} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {atoms as a} from '#/alf'
import {type Drawing, GRID_SIZE, pixelPaths} from '#/features/pixelEditor/model'

/** Shared by the editor, previews, and every avatar; never intercepts input. */
export const PixelLayer = memo(function PixelLayer({
  drawing,
  size,
  borderRadius = size / 2,
}: {
  drawing: Drawing
  size: number
  borderRadius?: ViewStyle['borderRadius']
}) {
  return (
    <View
      testID="drawingPixelLayer"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[a.absolute, a.inset_0, a.overflow_hidden, {borderRadius}]}>
      <Svg width={size} height={size} viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}>
        {pixelPaths(drawing.pixels, drawing.palette).map((d, index) =>
          d ? <Path key={index} d={d} fill={drawing.palette[index]} /> : null,
        )}
      </Svg>
    </View>
  )
})
