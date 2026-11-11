import {Text, View} from 'react-native'
import {render, renderHook} from '@testing-library/react-native'

import {useLayoutBreakpoints} from '#/alf/breakpoints'
import {getProduct, PRODUCT} from '#/config/product'
import {PageLayoutProvider, usePageLayout} from './context'
import {usePageGeometry} from './usePageGeometry'

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('#/env', () => ({IS_WEB: true}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: true}),
}))
jest.mock('react-responsive', () => ({
  useMediaQuery: ({
    minWidth = 0,
    maxWidth = Infinity,
  }: {
    minWidth?: number
    maxWidth?: number
  }) => mockWidth >= minWidth && mockWidth <= maxWidth,
}))
jest.mock('react-native', () => {
  const actual =
    jest.requireActual<typeof import('react-native')>('react-native')
  return Object.defineProperty(
    Object.create(actual) as typeof actual,
    'useWindowDimensions',
    {value: () => ({width: mockWidth})},
  )
})
jest.mock('#/alf/breakpoints', () => jest.requireActual('#/alf/breakpoints.ts'))
let mockWidth = 1920
beforeEach(() => {
  mockWidth = 1920
})
afterEach(() => jest.restoreAllMocks())

it('updates the shared sidebar visibility without changing standard content width', () => {
  jest.replaceProperty(PRODUCT, 'layout', getProduct('news').layout)
  const {result} = renderHook(
    () => ({...useLayoutBreakpoints(), ...usePageGeometry()}),
    {
      wrapper: ({children}) => (
        <PageLayoutProvider routeName="Profile">{children}</PageLayoutProvider>
      ),
    },
  )
  expect(result.current).toMatchObject({
    rightNavVisible: false,
    width: 600,
    wide: false,
  })
})
it('gives Publisher the space beside the pinned nav, capped at 1440px', () => {
  jest.replaceProperty(PRODUCT, 'layout', getProduct('news').layout)
  const {result} = renderHook(usePageGeometry, {
    wrapper: ({children}) => (
      <PageLayoutProvider routeName="Publisher">{children}</PageLayoutProvider>
    ),
  })
  expect(result.current).toEqual({width: 1440, offset: 120, wide: true})
})
it('reserves a replacement rail and keeps tablet geometry independent of visibility', () => {
  jest.replaceProperty(PRODUCT, 'layout', {
    defaults: {},
    pages: {Publisher: {contentWidth: 'wide', rightSidebar: 'default'}},
  })
  const {result} = renderHook(
    () => ({...useLayoutBreakpoints(), ...usePageGeometry()}),
    {
      wrapper: ({children}) => (
        <PageLayoutProvider routeName="Publisher">
          {children}
        </PageLayoutProvider>
      ),
    },
  )
  expect(result.current).toMatchObject({rightNavVisible: true, width: 870})
})
it('resolves simultaneous cached scenes with their own route policies', () => {
  jest.replaceProperty(PRODUCT, 'layout', getProduct('news').layout)
  function Probe() {
    return <Text>{usePageLayout().contentWidth}</Text>
  }
  const screen = render(
    <View>
      <PageLayoutProvider routeName="Publisher">
        <Probe />
      </PageLayoutProvider>
      <PageLayoutProvider routeName="Profile">
        <Probe />
      </PageLayoutProvider>
    </View>,
  )
  expect(screen.getByText('wide')).toBeTruthy()
  expect(screen.getByText('standard')).toBeTruthy()
})
it('collapses wide pages on small windows', () => {
  mockWidth = 390
  jest.replaceProperty(PRODUCT, 'layout', getProduct('news').layout)
  const {result} = renderHook(usePageGeometry, {
    wrapper: ({children}) => (
      <PageLayoutProvider routeName="Publisher">{children}</PageLayoutProvider>
    ),
  })
  expect(result.current.wide).toBe(false)
})
it('centres news pages beside the pinned nav without the tablet shift', () => {
  mockWidth = 1200
  jest.replaceProperty(PRODUCT, 'layout', getProduct('news').layout)
  const {result} = renderHook(
    () => ({...useLayoutBreakpoints(), ...usePageGeometry()}),
    {
      wrapper: ({children}) => (
        <PageLayoutProvider routeName="Home">{children}</PageLayoutProvider>
      ),
    },
  )
  expect(result.current).toMatchObject({
    centerColumnOffset: false,
    width: 1120,
    offset: 40,
    wide: true,
  })
})
it('keeps the social tablet shift', () => {
  mockWidth = 1200
  const {result} = renderHook(useLayoutBreakpoints, {
    wrapper: ({children}) => (
      <PageLayoutProvider routeName="Home">{children}</PageLayoutProvider>
    ),
  })
  expect(result.current.centerColumnOffset).toBe(true)
})
