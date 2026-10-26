import {StyleSheet} from 'react-native'
import {cancelAnimation, withTiming} from 'react-native-reanimated'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {act, render} from '@testing-library/react-native'

import {PetCompanion} from '#/features/petCompanion'
import {PetSprite} from '#/features/petCompanion/PetSprite'
import {PET_LIST} from '#/features/petCompanion/registry'
import {PixelArtImage} from '../../../modules/expo-bluesky-swiss-army/src/PixelArtImage'
import {halloweenGhost} from './ghost'

const mockPreference = {enabled: false, species: 'cat', variant: 'black'}
let mockActive = false
let mockHasSession = true
let mockReducedMotion = false
const mockFooterHeight = {value: 64}

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 390, height: 844, scale: 1, fontScale: 1}),
}))
jest.mock('react-native-reanimated', () => {
  const {View} =
    jest.requireActual<typeof import('react-native')>('react-native')
  const {useRef} = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: {View},
    cancelAnimation: jest.fn(),
    Easing: {linear: (value: number) => value},
    runOnJS: (callback: unknown) => callback,
    useAnimatedStyle: (callback: () => object) => callback(),
    useReducedMotion: () => mockReducedMotion,
    useSharedValue: (value: number) => useRef({value}).current,
    withTiming: jest.fn((value: number) => value),
  }
})
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isActive: mockActive}),
}))
jest.mock('#/state/preferences/pet-companion', () => ({
  usePetCompanion: () => mockPreference,
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: mockHasSession}),
}))
jest.mock('#/state/shell/shell-layout', () => ({
  useShellLayout: () => ({footerHeight: mockFooterHeight}),
}))
jest.mock('#/lib/haptics', () => ({useHaptics: () => jest.fn()}))
jest.mock('#/alf', () => ({
  atoms: {},
  web: () => undefined,
}))
jest.mock('../../../modules/expo-bluesky-swiss-army/src/PixelArtImage', () => ({
  PixelArtImage: jest.fn(() => null),
}))

const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function renderCompanion() {
  const element = () => (
    <I18nProvider i18n={i18n}>
      <PetCompanion />
    </I18nProvider>
  )
  const screen = render(element())
  return {...screen, refresh: () => screen.rerender(element())}
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockPreference.enabled = false
  mockActive = false
  mockHasSession = true
  mockReducedMotion = false
  mockFooterHeight.value = 64
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it('keeps pets disabled outside Halloween and does not register the ghost as a selectable pet', () => {
  const screen = renderCompanion()
  expect(screen.toJSON()).toBeNull()
  expect(PET_LIST).not.toContain(halloweenGhost)
})

it.each([false, true])(
  'shows only the ghost during Halloween with pets enabled=%s',
  enabled => {
    mockActive = true
    mockPreference.enabled = enabled
    const screen = renderCompanion()
    expect(screen.UNSAFE_getAllByType(PetSprite)).toHaveLength(1)
    expect(screen.UNSAFE_getByType(PetSprite).props.species).toBe(
      halloweenGhost,
    )
    const ghost = screen.getByTestId('halloweenGhost', {
      includeHiddenElements: true,
    })
    expect(ghost.props.pointerEvents).toBe('none')
    expect(ghost.props.accessibilityElementsHidden).toBe(true)
    expect(ghost.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(ghost.props['aria-hidden']).toBe(true)
    expect(
      screen.queryByRole('button', {includeHiddenElements: true}),
    ).toBeNull()
    expect(StyleSheet.flatten(ghost.props.style)).toMatchObject({bottom: 64})
  },
)

it.each([false, true])(
  'restores the saved pet preference on opt-out or expiry, enabled=%s',
  enabled => {
    mockActive = true
    mockPreference.enabled = enabled
    const saved = {...mockPreference}
    const screen = renderCompanion()
    mockActive = false
    screen.refresh()
    expect(mockPreference).toEqual(saved)
    expect(
      screen.queryByTestId('halloweenGhost', {includeHiddenElements: true}),
    ).toBeNull()
    if (enabled) {
      expect(screen.UNSAFE_getByType(PetSprite).props.species).toMatchObject({
        id: 'cat',
      })
      expect(screen.UNSAFE_getByType(PetSprite).props.variant).toBe('black')
      expect(screen.getByRole('button')).toBeTruthy()
    } else {
      expect(screen.toJSON()).toBeNull()
      expect(jest.getTimerCount()).toBe(0)
    }
  },
)

it('animates the cute ghost while resting and floating, then rests on arrival', () => {
  mockActive = true
  const screen = renderCompanion()
  expect(screen.UNSAFE_getByType(PetSprite).props.state).toBe('Idle')
  act(() => jest.advanceTimersByTime(400))
  expect(
    StyleSheet.flatten(screen.UNSAFE_getByType(PixelArtImage).props.style),
  ).toMatchObject({left: -192, top: -0})

  jest.spyOn(Math, 'random').mockReturnValue(0.1)
  act(() => jest.advanceTimersByTime(400))
  expect(screen.UNSAFE_getByType(PetSprite).props.state).toBe('Idle')
  act(() => jest.advanceTimersByTime(600))
  expect(
    StyleSheet.flatten(screen.UNSAFE_getByType(PixelArtImage).props.style),
  ).toMatchObject({left: -0, top: -0})
  expect(withTiming).toHaveBeenCalledWith(
    expect.any(Number),
    expect.objectContaining({duration: expect.any(Number)}),
    expect.any(Function),
  )

  jest.spyOn(Math, 'random').mockReturnValue(0.9)
  const onArrive = jest.mocked(withTiming).mock.calls[0][2]!
  act(() => onArrive(true))
  expect(screen.UNSAFE_getByType(PetSprite).props.state).toBe('Idle')
  screen.unmount()
  expect(cancelAnimation).toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

it.each([
  {direction: 'left', targetFraction: 0, target: 6, facing: 1},
  {direction: 'right', targetFraction: 1, target: 288, facing: -1},
])(
  'faces $direction while floating $direction',
  ({targetFraction, target, facing}) => {
    mockActive = true
    const screen = renderCompanion()
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValue(targetFraction)
    act(() => jest.advanceTimersByTime(800))
    expect(withTiming).toHaveBeenCalledWith(
      target,
      expect.any(Object),
      expect.any(Function),
    )
    expect(screen.UNSAFE_getByType(PetSprite).props.facing).toBe(facing)
  },
)

it('holds a static idle ghost without frame or movement timers for reduced motion', () => {
  mockActive = true
  mockReducedMotion = true
  const screen = renderCompanion()
  expect(screen.UNSAFE_getByType(PetSprite).props).toMatchObject({
    state: 'Idle',
    animate: false,
  })
  expect(jest.getTimerCount()).toBe(0)
  act(() => jest.advanceTimersByTime(30000))
  expect(withTiming).not.toHaveBeenCalled()
})

it('uses the viewport bottom on desktop and removes the ghost and timers on sign-out', () => {
  mockActive = true
  mockFooterHeight.value = 0
  const screen = renderCompanion()
  expect(
    StyleSheet.flatten(
      screen.getByTestId('halloweenGhost', {includeHiddenElements: true}).props
        .style,
    ),
  ).toMatchObject({bottom: 0})
  mockHasSession = false
  screen.refresh()
  expect(screen.toJSON()).toBeNull()
  expect(jest.getTimerCount()).toBe(0)
})
