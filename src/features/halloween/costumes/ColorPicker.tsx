import {useEffect, useId, useRef, useState} from 'react'
import {View} from 'react-native'
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg'
import {useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import * as TextField from '#/components/forms/TextField'
import {
  hexToHsv,
  type HSV,
  hsvToHex,
  normalizeHex,
} from '#/features/halloween/costumes/colors'
import {DrawingSurface} from '#/features/halloween/costumes/DrawingSurface'
import {type Point} from '#/features/halloween/costumes/model'

/** The same HSV picker on touch and desktop, with a precise hex alternative. */
export function ColorPicker({
  color,
  width,
  maxHeight,
  onChange,
  onInteractionChange,
}: {
  color: string
  width: number
  maxHeight: number
  onChange: (color: string) => void
  onInteractionChange?: (active: boolean) => void
}) {
  const {t: l} = useLingui()
  const [hsv, setHsv] = useState(() => hexToHsv(color))
  const [hex, setHex] = useState(color)
  const lastEmitted = useRef(color)
  const id = useId().replace(/:/g, '')
  const size = Math.max(64, Math.min(width, maxHeight - 104))
  useEffect(() => {
    if (color !== lastEmitted.current) {
      setHsv(hexToHsv(color))
      setHex(color)
      lastEmitted.current = color
    }
  }, [color])
  const change = (next: HSV) => {
    const nextHex = hsvToHex(next)
    setHsv(next)
    setHex(nextHex)
    lastEmitted.current = nextHex
    onChange(nextHex)
  }
  const chooseSV = (point: Point | null) => {
    if (point) change({...hsv, s: point.x / 100, v: 1 - point.y / 100})
  }
  const chooseHue = (point: Point | null) => {
    if (point) change({...hsv, h: point.x})
  }

  return (
    <View testID="costumeColorPicker" style={[a.gap_md, {width}]}>
      <View style={[a.relative]}>
        <DrawingSurface
          size={size}
          gridSize={101}
          label={l`Saturation and brightness`}
          hint={l`Drag to choose a color, or use arrow keys and Space.`}
          onStart={point => {
            onInteractionChange?.(true)
            chooseSV(point)
          }}
          onMove={chooseSV}
          onEnd={() => onInteractionChange?.(false)}
          onCancel={() => onInteractionChange?.(false)}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id={`${id}white`} x1="0" x2="1" y1="0" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id={`${id}black`} x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" />
              </LinearGradient>
            </Defs>
            <Rect
              width={size}
              height={size}
              fill={hsvToHex({h: hsv.h, s: 1, v: 1})}
            />
            <Rect width={size} height={size} fill={`url(#${id}white)`} />
            <Rect width={size} height={size} fill={`url(#${id}black)`} />
          </Svg>
        </DrawingSurface>
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            a.rounded_full,
            {
              left: hsv.s * (size - 1) - 6,
              top: (1 - hsv.v) * (size - 1) - 6,
              width: 12,
              height: 12,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <View style={[a.relative]}>
        <DrawingSurface
          size={size}
          height={24}
          gridSize={360}
          label={l`Hue`}
          hint={l`Drag to choose a hue, or use arrow keys and Space.`}
          onStart={point => {
            onInteractionChange?.(true)
            chooseHue(point)
          }}
          onMove={chooseHue}
          onEnd={() => onInteractionChange?.(false)}
          onCancel={() => onInteractionChange?.(false)}>
          <Svg width={size} height={24}>
            <Defs>
              <LinearGradient id={`${id}hue`} x1="0" x2="1" y1="0" y2="0">
                {[
                  '#FF0000',
                  '#FFFF00',
                  '#00FF00',
                  '#00FFFF',
                  '#0000FF',
                  '#FF00FF',
                  '#FF0000',
                ].map((stop, i) => (
                  <Stop key={i} offset={i / 6} stopColor={stop} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width={size} height={24} rx={4} fill={`url(#${id}hue)`} />
          </Svg>
        </DrawingSurface>
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            {
              left: (hsv.h / 360) * (size - 1) - 2,
              top: 0,
              width: 4,
              height: 24,
              borderWidth: 1,
              borderColor: '#FFFFFF',
              backgroundColor: '#000000',
            },
          ]}
        />
      </View>
      <TextField.Root>
        <TextField.Input
          testID="costumeHexColor"
          label={l`Hex color`}
          value={hex}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect={false}
          selectTextOnFocus
          onChangeText={value => {
            setHex(value)
            const next = normalizeHex(value)
            if (next) {
              lastEmitted.current = next
              setHsv(hexToHsv(next))
              onChange(next)
            }
          }}
          onBlur={() => setHex(color)}
        />
      </TextField.Root>
    </View>
  )
}
