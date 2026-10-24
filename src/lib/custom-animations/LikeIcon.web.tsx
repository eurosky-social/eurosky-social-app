import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {useReducedMotion} from 'react-native-reanimated'

import {type AnimatedLikeIconProps} from '#/lib/custom-animations/LikeIcon.types'
import {useTheme} from '#/alf'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartIconFilled,
  Heart2_Stroke2_Corner0_Rounded as HeartIconOutline,
} from '#/components/icons/Heart2'

const animationConfig = {
  duration: 600,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  fill: 'forwards' as FillMode,
}

const keyframe = [
  {transform: 'scale(1)'},
  {transform: 'scale(0.7)'},
  {transform: 'scale(1.2)'},
  {transform: 'scale(1)'},
]

const circle1Keyframe = [
  {opacity: 0, transform: 'scale(0)'},
  {opacity: 0.4},
  {transform: 'scale(1.5)'},
  {opacity: 0.4},
  {opacity: 0, transform: 'scale(1.5)'},
]

const circle2Keyframe = [
  {opacity: 0, transform: 'scale(0)'},
  {opacity: 1},
  {transform: 'scale(0)'},
  {opacity: 1},
  {opacity: 0, transform: 'scale(1.5)'},
]

export function AnimatedLikeIcon({
  isLiked,
  big,
  hasBeenToggled,
  color: colorProp,
  icons,
}: AnimatedLikeIconProps) {
  const t = useTheme()
  const color = colorProp ?? t.palette.pink
  const FilledIcon = icons?.filled ?? HeartIconFilled
  const OutlineIcon = icons?.outline ?? HeartIconOutline
  const size = big ? 22 : 18
  const shouldAnimate = !useReducedMotion() && hasBeenToggled
  const prevIsLiked = useRef(isLiked)

  const likeIconRef = useRef<HTMLDivElement>(null)
  const circle1Ref = useRef<HTMLDivElement>(null)
  const circle2Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prevIsLiked.current === isLiked) {
      return
    }

    if (shouldAnimate && isLiked) {
      likeIconRef.current?.animate?.(keyframe, animationConfig)
      circle1Ref.current?.animate?.(circle1Keyframe, animationConfig)
      circle2Ref.current?.animate?.(circle2Keyframe, animationConfig)
    }
    prevIsLiked.current = isLiked
  }, [shouldAnimate, isLiked])

  return (
    <View>
      {isLiked ? (
        // @ts-expect-error is div
        <View ref={likeIconRef}>
          <FilledIcon style={{color}} width={size} />
        </View>
      ) : (
        <OutlineIcon
          style={[{color: t.palette.contrast_500}, {pointerEvents: 'none'}]}
          width={size}
        />
      )}
      <View
        // @ts-expect-error is div
        ref={circle1Ref}
        style={{
          position: 'absolute',
          backgroundColor: color,
          top: 0,
          left: 0,
          width: size,
          height: size,
          zIndex: -1,
          pointerEvents: 'none',
          borderRadius: size / 2,
          opacity: 0,
        }}
      />
      <View
        // @ts-expect-error is div
        ref={circle2Ref}
        style={{
          position: 'absolute',
          backgroundColor: t.atoms.bg.backgroundColor,
          top: 0,
          left: 0,
          width: size,
          height: size,
          zIndex: -1,
          pointerEvents: 'none',
          borderRadius: size / 2,
          opacity: 0,
        }}
      />
    </View>
  )
}
