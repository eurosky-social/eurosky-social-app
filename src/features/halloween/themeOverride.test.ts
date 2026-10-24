import {renderHook} from '@testing-library/react-native'

import {buildThemes} from '#/alf/themes'
import {useThemesOverride} from '#/alf/util/useThemesOverride'
import {halloweenThemes} from './themes'

let mockActive = false
let mockAccent: string | undefined
let mockBorders = 'standard'

jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isActive: mockActive}),
}))
jest.mock('#/state/shell', () => ({
  useThemePrefs: () => ({accentColor: mockAccent}),
}))
jest.mock('#/state/preferences', () => ({
  useInterfaceStyle: () => ({borders: mockBorders}),
}))

beforeEach(() => {
  mockActive = false
  mockAccent = undefined
  mockBorders = 'standard'
})

it('keeps the normal no-override path when Halloween is off', () => {
  const {result} = renderHook(useThemesOverride)
  expect(result.current).toBeUndefined()
})

it('temporarily overrides and then restores the saved custom accent', () => {
  mockAccent = 'blue'
  const {result, rerender} = renderHook(useThemesOverride)
  expect(result.current?.light.palette).toEqual(
    buildThemes('blue').light.palette,
  )
  mockActive = true
  rerender({})
  expect(result.current).toBe(halloweenThemes)
  mockActive = false
  rerender({})
  expect(result.current?.light.palette).toEqual(
    buildThemes('blue').light.palette,
  )
})

it('preserves hidden borders in every Halloween variant without mutating palettes', () => {
  mockActive = true
  mockBorders = 'hidden'
  const {result} = renderHook(useThemesOverride)
  for (const name of ['light', 'dark', 'dim'] as const) {
    expect(result.current?.[name].atoms.border_contrast_low.borderColor).toBe(
      'transparent',
    )
    expect(
      result.current?.[name].atoms.border_contrast_medium.borderColor,
    ).toBe('transparent')
    expect(
      halloweenThemes[name].atoms.border_contrast_low.borderColor,
    ).not.toBe('transparent')
    expect(result.current?.[name].palette).toBe(halloweenThemes[name].palette)
  }
})
