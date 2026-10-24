import {StyleSheet, useWindowDimensions, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Svg, {Path} from 'react-native-svg'

import {native, web} from '#/alf'
import {useHalloween} from '#/features/halloween/context'

type Point = readonly [number, number]

/** Original pixel webs: different spokes, spacing, and missing strands per corner. */
const webPaths = {
  topLeft: pixelWeb(
    [
      [63, 0],
      [53, 18],
      [38, 39],
      [18, 56],
      [0, 61],
    ],
    [0.2, 0.39, 0.64, 0.94],
    ['2:2'],
  ),
  topRight: pixelWeb(
    [
      [62, 0],
      [54, 11],
      [43, 27],
      [26, 43],
      [0, 48],
    ],
    [0.16, 0.34, 0.55, 0.76, 1],
    ['3:0', '4:3'],
  ),
  bottomLeft: pixelWeb(
    [
      [49, 0],
      [39, 22],
      [18, 45],
      [0, 58],
    ],
    [0.25, 0.49, 0.78, 1],
    ['2:0', '3:0', '3:1'],
  ),
  bottomRight: pixelWeb(
    [
      [61, 0],
      [56, 24],
      [36, 42],
      [17, 60],
      [0, 63],
    ],
    [0.19, 0.42, 0.7, 0.96],
    ['1:2', '3:1'],
  ),
}

/** Static, click-through decorations; no animation even without reduced motion. */
export function HalloweenCornerWebs() {
  const {isActive} = useHalloween()
  const {width, height} = useWindowDimensions()
  const insets = useSafeAreaInsets()

  if (!isActive) return null

  const size = Math.min(164, width * 0.24, height * 0.24)

  return (
    <View
      testID="halloweenCornerWebs"
      pointerEvents="none"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.overlay,
        native({
          top: insets.top,
          right: insets.right,
          bottom: insets.bottom,
          left: insets.left,
        }),
      ]}>
      <CornerWeb size={size} corner="topLeft" />
      <CornerWeb size={size * 0.92} corner="topRight" />
      <CornerWeb size={size * 0.72} corner="bottomLeft" />
      <CornerWeb size={size * 0.8} corner="bottomRight" />
    </View>
  )
}

function CornerWeb({
  size,
  corner,
}: {
  size: number
  corner: keyof typeof webPaths
}) {
  return (
    <View
      testID={`halloweenWeb-${corner}`}
      pointerEvents="none"
      style={[styles.corner, styles[corner], {width: size, height: size}]}>
      <Svg width={size} height={size} viewBox="0 0 64 64" pointerEvents="none">
        <Path fill="#e8dfd2" d={webPaths[corner]} />
      </Svg>
    </View>
  )
}

/** Build on a small integer grid so the strands have a gentle stair-step texture. */
function pixelWeb(spokes: Point[], rings: number[], gaps: string[]) {
  const pixels = new Set<string>()
  const line = (from: Point, to: Point) => {
    let x = Math.round(from[0])
    let y = Math.round(from[1])
    const endX = Math.round(to[0])
    const endY = Math.round(to[1])
    const dx = Math.abs(endX - x)
    const dy = -Math.abs(endY - y)
    const stepX = x < endX ? 1 : -1
    const stepY = y < endY ? 1 : -1
    let error = dx + dy

    while (true) {
      pixels.add(`M${x} ${y}h1v1h-1z`)
      if (x === endX && y === endY) break
      const twiceError = 2 * error
      if (twiceError >= dy) {
        error += dy
        x += stepX
      }
      if (twiceError <= dx) {
        error += dx
        y += stepY
      }
    }
  }

  for (const spoke of spokes) line([0, 0], spoke)
  rings.forEach((radius, ring) => {
    for (let segment = 0; segment < spokes.length - 1; segment++) {
      if (gaps.includes(`${ring}:${segment}`)) continue
      const start: Point = [
        spokes[segment][0] * radius,
        spokes[segment][1] * radius,
      ]
      const end: Point = [
        spokes[segment + 1][0] * radius,
        spokes[segment + 1][1] * radius,
      ]
      // Sample a slack curve onto the pixel grid rather than smoothing the steps.
      const control: Point = [
        (start[0] + end[0]) * 0.4,
        (start[1] + end[1]) * 0.4,
      ]
      let previous = start
      for (let step = 1; step <= 4; step++) {
        const t = step / 4
        const u = 1 - t
        const point: Point = [
          u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
          u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
        ]
        line(previous, point)
        previous = point
      }
    }
  })
  return [...pixels].join('')
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    ...web({position: 'fixed'}),
  },
  corner: {
    position: 'absolute',
    opacity: 0.28,
  },
  topLeft: {top: 0, left: 0},
  topRight: {top: 0, right: 0, transform: [{scaleX: -1}]},
  bottomLeft: {bottom: 0, left: 0, transform: [{scaleY: -1}], opacity: 0.22},
  bottomRight: {
    bottom: 0,
    right: 0,
    transform: [{scaleX: -1}, {scaleY: -1}],
    opacity: 0.24,
  },
})
