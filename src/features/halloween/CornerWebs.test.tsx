import * as ReactNative from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Path} from 'react-native-svg'
import {render} from '@testing-library/react-native'

import {HalloweenCornerWebs} from './CornerWebs'

const mockHalloween = {enabled: true, isActive: false}

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => mockHalloween,
}))
jest.mock('#/alf', () => ({
  native: (styles: object) => styles,
  web: () => undefined,
}))

beforeEach(() => {
  mockHalloween.enabled = true
  mockHalloween.isActive = false
  jest.mocked(ReactNative.useWindowDimensions).mockReturnValue({
    width: 390,
    height: 844,
    scale: 1,
    fontScale: 1,
  })
  jest.mocked(useSafeAreaInsets).mockReturnValue({
    top: 47,
    right: 0,
    bottom: 34,
    left: 0,
  })
})

afterEach(() => jest.restoreAllMocks())

it('does not render outside the active event, even with saved consent', () => {
  const screen = render(<HalloweenCornerWebs />)
  expect(screen.toJSON()).toBeNull()
})

it('renders four static, non-interactive, accessibility-hidden corners', () => {
  mockHalloween.isActive = true
  const screen = render(<HalloweenCornerWebs />)
  const overlay = screen.getByTestId('halloweenCornerWebs', {
    includeHiddenElements: true,
  })
  expect(overlay.props.pointerEvents).toBe('none')
  expect(overlay.props.accessible).toBe(false)
  expect(overlay.props['aria-hidden']).toBe(true)
  expect(overlay.props.accessibilityElementsHidden).toBe(true)
  expect(overlay.props.importantForAccessibility).toBe('no-hide-descendants')
  for (const corner of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
    expect(
      screen.getByTestId(`halloweenWeb-${corner}`, {
        includeHiddenElements: true,
      }).props.pointerEvents,
    ).toBe('none')
  }
})

it('uses four distinct pixel-grid designs instead of mirroring one web', () => {
  mockHalloween.isActive = true
  const screen = render(<HalloweenCornerWebs />)
  const paths = screen
    .UNSAFE_getAllByType(Path)
    .map(path => path.props.d as string)
  expect(paths).toHaveLength(4)
  expect(new Set(paths).size).toBe(4)
  for (const path of paths) {
    expect(path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/)
  }
})

it('removes every decoration immediately when Halloween stops being active', () => {
  mockHalloween.isActive = true
  const screen = render(<HalloweenCornerWebs />)
  expect(screen.toJSON()).not.toBeNull()
  mockHalloween.isActive = false
  screen.rerender(<HalloweenCornerWebs />)
  expect(screen.toJSON()).toBeNull()
})

it('keeps the overlay within native safe areas', () => {
  mockHalloween.isActive = true
  const screen = render(<HalloweenCornerWebs />)
  expect(
    ReactNative.StyleSheet.flatten(
      screen.getByTestId('halloweenCornerWebs', {includeHiddenElements: true})
        .props.style,
    ),
  ).toMatchObject({top: 47, right: 0, bottom: 34, left: 0})
})

it('scales down on phones and caps the size on desktop', () => {
  mockHalloween.isActive = true
  const screen = render(<HalloweenCornerWebs />)
  const size = () =>
    ReactNative.StyleSheet.flatten(
      screen.getByTestId('halloweenWeb-topLeft', {includeHiddenElements: true})
        .props.style as ReactNative.StyleProp<ReactNative.ViewStyle>,
    )?.width
  expect(size()).toBeCloseTo(93.6)

  jest.mocked(ReactNative.useWindowDimensions).mockReturnValue({
    width: 1440,
    height: 900,
    scale: 1,
    fontScale: 1,
  })
  screen.rerender(<HalloweenCornerWebs />)
  expect(size()).toBe(164)

  jest.mocked(ReactNative.useWindowDimensions).mockReturnValue({
    width: 844,
    height: 390,
    scale: 1,
    fontScale: 1,
  })
  screen.rerender(<HalloweenCornerWebs />)
  expect(size()).toBeCloseTo(93.6)
})
