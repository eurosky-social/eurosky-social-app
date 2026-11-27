import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {highlightedBars, type Moment, momentBars} from '../moments'

/** How many bars the strip has, as in the design canvas's feed card. */
const BARS = 48
const HEIGHT = 22

/**
 * Where people commented along a video, for a feed card (design canvas
 * "funk episode in the timeline"): one bar per stretch of the video, as high
 * as its share of comments, with the `highlighted` moments (the ones shown
 * as buttons below) in colour. Shows nothing until the video's length is
 * known. The insights page draws it larger (`bars`, `height`).
 */
export function MomentHeatStrip({
  moments,
  highlighted,
  duration,
  bars = BARS,
  height = HEIGHT,
}: {
  moments: Moment[]
  highlighted: Moment[]
  duration: number | undefined
  bars?: number
  height?: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  if (!duration) return null
  const values = momentBars(moments, duration, bars)
  const max = Math.max(...values)
  if (!(max > 0)) return null
  const lit = highlightedBars(highlighted, duration, bars)

  return (
    <View
      testID="mediaTimeHeatStrip"
      accessibilityRole="image"
      accessibilityLabel={l`Where people commented along the video`}
      accessibilityHint=""
      style={[a.flex_row, a.align_end, {height, gap: 2}]}>
      {values.map((value, i) => (
        <View
          key={i}
          style={[
            a.flex_1,
            {
              height: value > 0 ? Math.max(3, (value / max) * height) : 2,
              borderRadius: 1,
              backgroundColor: lit[i]
                ? t.palette.primary_500
                : t.palette.contrast_200,
            },
          ]}
        />
      ))}
    </View>
  )
}
