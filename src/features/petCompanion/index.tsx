import {useEffect, useRef, useState} from 'react'
import {Pressable, useWindowDimensions} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {usePetCompanion} from '#/state/preferences/pet-companion'
import {useSession} from '#/state/session'
import {useShellLayout} from '#/state/shell/shell-layout'
import {IS_WEB} from '#/env'
import {PetSprite} from './PetSprite'
import {getSpecies, resolveVariant} from './registry'
import {type Species} from './types'

// Horizontal padding kept clear of the screen edges while wandering.
const EDGE_MARGIN = 6
const MIN_WALK_MS = 700
// Chance the pet decides to wander rather than rest on any given decision.
const WALK_CHANCE = 0.45

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

/**
 * A small companion that wanders along the bottom of the screen (on top of the
 * bottom navbar on mobile) and reacts when you tap it. The species, its art and
 * its behaviour all come from the pet registry, so this director is agnostic to
 * which animal is shown. Gated behind the `petCompanion` preference and an
 * active session so it cleanly unmounts when turned off.
 */
export function PetCompanion() {
  const {enabled, species: speciesId, variant} = usePetCompanion()
  const {hasSession} = useSession()

  if (!enabled || !hasSession) return null

  const species = getSpecies(speciesId)
  return (
    // Remount when the species changes so the director restarts cleanly with
    // the new behaviour/geometry. Variant changes don't need a remount.
    <PetCompanionInner
      key={species.id}
      species={species}
      variant={resolveVariant(species, variant)}
    />
  )
}

function PetCompanionInner({
  species,
  variant,
}: {
  species: Species
  variant: string
}) {
  const {t: l} = useLingui()
  const {width} = useWindowDimensions()
  // The shell measures the real tab-bar height into footerHeight (both native
  // and BottomBarWeb), so the pet sits right on top of it. It's 0 on web
  // desktop, where there's no bottom bar, so the pet rests at the very bottom.
  const {footerHeight} = useShellLayout()
  const haptics = useHaptics()

  const {behavior} = species
  const size = species.size
  const walkFacesRight = behavior.walkFacesRight ?? true

  const [state, setState] = useState<string>(behavior.idle)
  const [facing, setFacing] = useState<1 | -1>(1)
  // Bumped to replay one-shot reactions when tapped repeatedly.
  const [playToken, setPlayToken] = useState(0)

  // Start roughly centered.
  const startX = Math.max(EDGE_MARGIN, width / 2 - size / 2)
  const tx = useSharedValue(startX)
  // JS-thread mirror of the pet's resting x, used to plan the next walk.
  const posRef = useRef(startX)
  // Latest viewport width, read inside scheduled callbacks.
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  // Pending rest/reaction timer.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Invalidates an in-flight walk's arrival callback when interrupted.
  const genRef = useRef(0)
  // The director loop, kept in a ref so event handlers can re-enter it.
  const startActionRef = useRef<() => void>(() => {})

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // Facing for a given travel direction, honouring the species' authored facing.
  const faceFor = (goingRight: boolean): 1 | -1 => {
    const base: 1 | -1 = goingRight ? 1 : -1
    return walkFacesRight ? base : ((base * -1) as 1 | -1)
  }

  useEffect(() => {
    const maxX = () =>
      Math.max(EDGE_MARGIN, widthRef.current - size - EDGE_MARGIN)

    const onArrive = (target: number, myGen: number) => {
      if (myGen !== genRef.current) return
      posRef.current = target
      startAction()
    }

    const walk = () => {
      const target = rand(EDGE_MARGIN, maxX())
      const goingRight = target > posRef.current
      setFacing(faceFor(goingRight))
      setState(behavior.walk)

      const distance = Math.abs(target - posRef.current)
      const duration = Math.max(
        MIN_WALK_MS,
        (distance / behavior.walkSpeed) * 1000,
      )
      const myGen = ++genRef.current
      tx.value = withTiming(
        target,
        {duration, easing: Easing.linear},
        finished => {
          'worklet'
          if (finished) runOnJS(onArrive)(target, myGen)
        },
      )
    }

    const rest = () => {
      const next = pick(behavior.ambient)
      setState(next.state)
      timerRef.current = setTimeout(startAction, rand(next.min, next.max))
    }

    function startAction() {
      clearTimer()
      if (Math.random() < WALK_CHANCE) {
        walk()
      } else {
        rest()
      }
    }

    startActionRef.current = startAction

    // Kick things off after a short beat so the pet "arrives".
    timerRef.current = setTimeout(startAction, 800)

    return () => {
      clearTimer()
      cancelAnimation(tx)
      genRef.current++
    }
  }, [tx, behavior, size, walkFacesRight])

  // Pause briefly after a reaction, then hand control back to the director.
  const resumeWandering = () => {
    clearTimer()
    setState(behavior.idle)
    timerRef.current = setTimeout(
      () => startActionRef.current(),
      rand(900, 2000),
    )
  }

  const onPet = () => {
    // Stop whatever the pet was doing and freeze it in place.
    clearTimer()
    genRef.current++
    cancelAnimation(tx)
    posRef.current = tx.value

    haptics('Light')

    // Play a random reaction. Looping reactions are held briefly then resumed
    // here; one-shots resume via PetSprite.onAnimationEnd.
    const reaction = pick(behavior.reactions)
    setPlayToken(t => t + 1)
    setState(reaction)
    if (species.loopStates.includes(reaction)) {
      timerRef.current = setTimeout(resumeWandering, 2600)
    }
  }

  const onAnimationEnd = () => {
    // Only reactions are one-shots, so this means a reaction just finished.
    resumeWandering()
  }

  const animatedStyle = useAnimatedStyle(() => ({
    bottom: footerHeight.value,
    transform: [{translateX: tx.value}],
  }))

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          // Pin to the viewport on web so the pet doesn't scroll with content.
          // 'fixed' is web-only; cast keeps the RN ViewStyle type happy.
          position: (IS_WEB ? 'fixed' : 'absolute') as 'absolute',
          left: 0,
          width: size,
          height: size,
        },
        animatedStyle,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={l`Pet your companion`}
        accessibilityHint={l`Plays a happy reaction`}
        onPress={onPet}>
        <PetSprite
          species={species}
          variant={variant}
          state={state}
          facing={facing}
          size={size}
          playToken={playToken}
          onAnimationEnd={onAnimationEnd}
        />
      </Pressable>
    </Animated.View>
  )
}
