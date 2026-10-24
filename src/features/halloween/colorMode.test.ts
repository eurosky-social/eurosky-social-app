import {renderHook} from '@testing-library/react-native'

import {useThemeName} from '#/alf/util/useColorModeTheme'

let mockActive = false
let mockSystemScheme: 'light' | 'dark' = 'light'
let mockColorMode: 'system' | 'light' | 'dark' = 'system'
let mockDarkTheme: 'dim' | 'dark' | undefined = 'dim'

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSystemScheme,
}))
jest.mock('#/state/shell', () => ({
  useThemePrefs: () => ({colorMode: mockColorMode, darkTheme: mockDarkTheme}),
}))
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isActive: mockActive}),
}))

beforeEach(() => {
  mockActive = false
  mockSystemScheme = 'light'
  mockColorMode = 'system'
  mockDarkTheme = 'dim'
})

it.each(['system', 'light', 'dark'] as const)(
  'temporarily forces true dark mode over saved %s mode, then restores it',
  mode => {
    mockColorMode = mode
    const {result, rerender} = renderHook(useThemeName)
    const savedTheme = result.current
    mockActive = true
    rerender({})
    expect(result.current).toBe('dark')
    mockActive = false
    rerender({})
    expect(result.current).toBe(savedTheme)
    expect(mockColorMode).toBe(mode)
    expect(mockDarkTheme).toBe('dim')
  },
)

it('restores the current system appearance after Halloween ends', () => {
  mockActive = true
  const {result, rerender} = renderHook(useThemeName)
  expect(result.current).toBe('dark')
  mockSystemScheme = 'dark'
  mockActive = false
  rerender({})
  expect(result.current).toBe('dim')
  mockSystemScheme = 'light'
  rerender({})
  expect(result.current).toBe('light')
})

it('keeps the normal true-dark preference when Halloween is off', () => {
  mockColorMode = 'dark'
  mockDarkTheme = 'dark'
  const {result} = renderHook(useThemeName)
  expect(result.current).toBe('dark')
})
