import {forwardRef, useCallback, useEffect, useImperativeHandle} from 'react'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, {Circle, Path} from 'react-native-svg'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Lucide circle-check geometry, kept as strokes for the draw animation. */
const PATH = 'm9 12 2 2 4-4'
const CIRCLE_LENGTH = 2 * Math.PI * 10
const CHECK_LENGTH = Math.SQRT2 * 6

export interface AnimatedCheckRef {
  play(cb?: () => void): void
}

export interface AnimatedCheckProps extends Props {
  playOnMount?: boolean
}

export const AnimatedCheck = forwardRef<AnimatedCheckRef, AnimatedCheckProps>(
  function AnimatedCheck({playOnMount, ...props}, ref) {
    const {fill, size, style, ...rest} = useCommonSVGProps(props)
    const circleAnim = useSharedValue(0)
    const checkAnim = useSharedValue(0)

    const circleAnimatedProps = useAnimatedProps(() => ({
      strokeDashoffset: CIRCLE_LENGTH * (1 - circleAnim.get()),
    }))
    const checkAnimatedProps = useAnimatedProps(() => ({
      strokeDashoffset: CHECK_LENGTH * (1 - checkAnim.get()),
    }))

    const play = useCallback(
      (cb?: () => void) => {
        circleAnim.set(0)
        checkAnim.set(0)

        circleAnim.set(withTiming(1, {duration: 500, easing: Easing.linear}))
        checkAnim.set(
          withDelay(
            500,
            withTiming(1, {duration: 300, easing: Easing.linear}, cb),
          ),
        )
      },
      [circleAnim, checkAnim],
    )

    useImperativeHandle(ref, () => ({
      play,
    }))

    useEffect(() => {
      if (playOnMount) {
        play()
      }
    }, [play, playOnMount])

    return (
      <Svg
        fill="none"
        {...rest}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={style}>
        <AnimatedCircle
          animatedProps={circleAnimatedProps}
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={fill}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={CIRCLE_LENGTH}
        />
        <AnimatedPath
          animatedProps={checkAnimatedProps}
          stroke={fill}
          d={PATH}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
        />
      </Svg>
    )
  },
)
