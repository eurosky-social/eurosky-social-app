import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'

import {atoms as a, web} from '#/alf'
import {resolveVariant} from './registry'
import {type Species} from './types'

/**
 * Renders one animation frame of a companion species' spritesheet, advancing
 * frames on a timer. Species-agnostic: all geometry (frame size, grid) and the
 * animation catalog come from the passed `species`, so the same renderer drives
 * a 64px cat or any other pack, including sheets whose animations start at an
 * arbitrary column and wrap across rows.
 */
export function PetSprite({
  species,
  variant,
  state,
  size = species.size,
  facing = 1,
  // Bump to replay a one-shot animation even when `state` is unchanged.
  playToken = 0,
  onAnimationEnd,
}: {
  species: Species
  variant: string
  state: string
  size?: number
  facing?: 1 | -1
  playToken?: number
  onAnimationEnd?: () => void
}) {
  const {frame, cols, rows} = species
  const clip = species.clips[state] ?? species.clips[species.behavior.idle]
  const loop = species.loopStates.includes(state)
  const sheet = species.sheets[resolveVariant(species, variant)]
  const [frameIdx, setFrameIdx] = useState(0)

  // Reset to the first frame whenever the animation changes (or a one-shot is
  // replayed via playToken). Adjusting state during render is the React-
  // recommended alternative to doing it in an effect.
  const animationKey = `${state}:${playToken}`
  const [prevAnimationKey, setPrevAnimationKey] = useState(animationKey)
  if (animationKey !== prevAnimationKey) {
    setPrevAnimationKey(animationKey)
    setFrameIdx(0)
  }

  // Keep the latest callback without restarting the timer.
  const onEndRef = useRef(onAnimationEnd)
  useEffect(() => {
    onEndRef.current = onAnimationEnd
  })

  useEffect(() => {
    if (clip.frames <= 1) {
      if (!loop) onEndRef.current?.()
      return
    }

    let f = 0
    const id = setInterval(() => {
      f += 1
      if (f >= clip.frames) {
        if (loop) {
          f = 0
        } else {
          // Hold the last frame and report completion.
          setFrameIdx(clip.frames - 1)
          clearInterval(id)
          onEndRef.current?.()
          return
        }
      }
      setFrameIdx(f)
    }, 1000 / clip.fps)

    return () => clearInterval(id)
    // playToken forces a restart for repeated one-shots.
  }, [state, playToken, clip.frames, clip.fps, loop])

  // Frames read left-to-right from (row, col), wrapping at `cols`, so a clip can
  // start mid-row or span rows.
  const cell = clip.row * cols + (clip.col ?? 0) + frameIdx
  const cx = cell % cols
  const cy = Math.floor(cell / cols)

  // Render the sheet at an integer multiple of the cell (FRAME), then uniformly
  // downsample to `size`. `imageRendering: pixelated` does nearest-neighbour
  // scaling, which only stays even at integer ratios; at a fractional ratio
  // (e.g. 88/64) some source pixels span 1 device pixel and others 2, which
  // reads as a shimmering, misaligned sprite on the web (notably desktop
  // Firefox at devicePixelRatio 1). Drawing at the nearest whole multiple keeps
  // nearest-neighbour even, and the final downscale is one uniform transform.
  const renderScale = Math.max(1, Math.ceil(size / frame))
  const renderPx = frame * renderScale
  const downsample = size / renderPx
  // Drop the sprite by its transparent bottom padding so every state's feet
  // land on the same ground line. Expressed in render-scale space; the outer
  // downsample brings it back to `size` space.
  const dropY = clip.pad * renderScale

  return (
    <View style={{width: size, height: size, overflow: 'hidden'}}>
      {/* Uniformly shrink the integer-scaled sprite into the layout box. */}
      <View
        style={{
          width: renderPx,
          height: renderPx,
          transform: [{scale: downsample}],
          transformOrigin: 'top left',
        }}>
        <View
          style={{
            width: renderPx,
            height: renderPx,
            overflow: 'hidden',
            transform:
              facing === -1
                ? [{translateY: dropY}, {scaleX: -1}]
                : [{translateY: dropY}],
          }}>
          <Image
            source={sheet}
            accessibilityIgnoresInvertColors
            contentFit="fill"
            style={[
              a.absolute,
              {
                width: cols * renderPx,
                height: rows * renderPx,
                left: -cx * renderPx,
                top: -cy * renderPx,
              },
              // Crisp pixel-art scaling on web; native ignores this.
              web({
                imageRendering: 'pixelated',
                // Stop mobile Safari from opening/saving the raw spritesheet on
                // a long press. Routing touches past the <img> to the Pressable
                // also kills the iOS image callout, so petting still works.
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }),
            ]}
          />
        </View>
      </View>
    </View>
  )
}
