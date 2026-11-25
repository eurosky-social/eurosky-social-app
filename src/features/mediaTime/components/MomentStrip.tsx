import {useMemo, useRef} from 'react'
import {type GestureResponderEvent, Pressable, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {barAt, type Moment, momentBars} from '../moments'
import {formatMediaTime} from '../record'

/** Bars along the video, as in the design. */
const BARS = 64
const HEIGHT = 28
/** Bars without comments still show, as a low line. */
const EMPTY_HEIGHT = 2
const MIN_HEIGHT = 4

/**
 * Where people commented along a video: one bar per stretch of the video,
 * as high as its share of comments. The open moment is highlighted, bars
 * already played are tinted, and a line shows where the video is. Tapping
 * the strip passes the second tapped. Shows nothing until the video's
 * length is known.
 */
export function MomentStrip({
  moments,
  current,
  duration,
  playing,
  onPressSecond,
}: {
  moments: Moment[]
  current: Moment | undefined
  duration: number | undefined
  playing: number | undefined
  onPressSecond: (seconds: number) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const barsRef = useRef<React.ComponentRef<typeof View>>(null)
  const bars = useMemo(
    () => (duration ? momentBars(moments, duration, BARS) : []),
    [moments, duration],
  )

  if (!duration || bars.length === 0) return null

  const max = Math.max(1, ...bars)
  const position = Math.min(1, Math.max(0, (playing ?? 0) / duration))
  const currentFirst = current
    ? barAt(current.startSeconds, duration, BARS)
    : -1
  const currentLast = current ? barAt(current.endSeconds, duration, BARS) : -1

  // Where the tap landed on the page, against where the bars are: the
  // web doesn't fill in a press's position within its target.
  const onPress = (e: GestureResponderEvent) => {
    const pressX = e.nativeEvent.pageX
    barsRef.current?.measure((_x, _y, width, _height, pageX) => {
      if (!width || !Number.isFinite(pressX) || !Number.isFinite(pageX)) {
        return
      }
      const x = Math.min(width, Math.max(0, pressX - pageX))
      onPressSecond(Math.round((x / width) * duration))
    })
  }

  return (
    <Pressable
      testID="momentStrip"
      accessibilityRole="button"
      accessibilityLabel={l`Where people commented along the video`}
      accessibilityHint={l`Plays the video from the point you tap`}
      onPress={onPress}
      style={[a.gap_xs]}>
      <View
        ref={barsRef}
        style={[a.flex_row, a.align_end, {height: HEIGHT, gap: 2}]}>
        {bars.map((value, i) => {
          const inCurrent = i >= currentFirst && i <= currentLast
          const played = i / BARS < position
          return (
            <View
              key={i}
              style={[
                a.flex_1,
                {
                  borderRadius: 1,
                  height:
                    value > 0
                      ? MIN_HEIGHT + (value / max) * (HEIGHT - MIN_HEIGHT)
                      : EMPTY_HEIGHT,
                  backgroundColor: inCurrent
                    ? t.palette.primary_500
                    : played
                      ? t.palette.primary_200
                      : t.palette.contrast_200,
                },
              ]}
            />
          )
        })}
      </View>
      <View
        style={[
          a.rounded_full,
          a.overflow_hidden,
          t.atoms.bg_contrast_100,
          {height: 3},
        ]}>
        <View
          style={{
            width: `${position * 100}%`,
            height: 3,
            backgroundColor: t.palette.primary_500,
          }}
        />
      </View>
      <View style={[a.flex_row, a.justify_between]}>
        <Text
          style={[
            a.text_xs,
            t.atoms.text_contrast_medium,
            {fontVariant: ['tabular-nums']},
          ]}>
          {formatMediaTime(playing ?? 0)}
        </Text>
        <Text
          style={[
            a.text_xs,
            t.atoms.text_contrast_medium,
            {fontVariant: ['tabular-nums']},
          ]}>
          {formatMediaTime(Math.round(duration))}
        </Text>
      </View>
    </Pressable>
  )
}
