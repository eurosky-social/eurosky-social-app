import {renderHook} from '@testing-library/react-native'

import {buildThemes} from '#/alf/themes'
import {type AccentKey, ACCENTS, DEFAULT_ACCENT} from '#/config/brand-theme'
import {useThemesOverride} from './useThemesOverride'

let mockAccent: string | undefined
let mockBorders = 'standard'

jest.mock('#/state/shell', () => ({
  useThemePrefs: () => ({accentColor: mockAccent}),
}))
jest.mock('#/state/preferences', () => ({
  useInterfaceStyle: () => ({borders: mockBorders}),
}))

beforeEach(() => {
  mockAccent = undefined
  mockBorders = 'standard'
})

it.each([undefined, DEFAULT_ACCENT, 'unknown-accent'])(
  'uses the normal no-override path for accent %s',
  accent => {
    mockAccent = accent
    const {result} = renderHook(useThemesOverride)
    expect(result.current).toBeUndefined()
  },
)

it.each(Object.keys(ACCENTS).filter(key => key !== DEFAULT_ACCENT))(
  'uses the saved %s accent in every theme',
  accent => {
    mockAccent = accent
    const {result} = renderHook(useThemesOverride)
    const expected = buildThemes(accent as AccentKey)
    for (const name of ['light', 'dark', 'dim'] as const) {
      expect(result.current?.[name].palette).toEqual(expected[name].palette)
    }
  },
)

it('hides borders without changing the saved accent or mutating base themes', () => {
  mockAccent = 'blue'
  mockBorders = 'hidden'
  const {result, rerender} = renderHook(useThemesOverride)
  const expected = buildThemes('blue')
  for (const name of ['light', 'dark', 'dim'] as const) {
    expect(result.current?.[name].atoms.border_contrast_low.borderColor).toBe(
      'transparent',
    )
    expect(
      result.current?.[name].atoms.border_contrast_medium.borderColor,
    ).toBe('transparent')
    expect(expected[name].atoms.border_contrast_low.borderColor).not.toBe(
      'transparent',
    )
    expect(result.current?.[name].palette).toEqual(expected[name].palette)
  }
  mockBorders = 'standard'
  rerender({})
  expect(result.current?.light.atoms.border_contrast_low).toEqual(
    expected.light.atoms.border_contrast_low,
  )
})
