import {getProduct, PRODUCT} from '#/config/product'
import {getThemeName} from '../useColorModeTheme'

jest.mock('#/config/product', () => {
  const actual =
    jest.requireActual<typeof import('#/config/product')>('#/config/product')
  return {...actual, PRODUCT: actual.getProduct('social')}
})

afterEach(() => jest.restoreAllMocks())

it('follows the device in the news product, whatever was stored', () => {
  jest.replaceProperty(PRODUCT, 'id', getProduct('news').id)
  expect(getThemeName('light', 'dark', 'dark')).toBe('light')
  expect(getThemeName('dark', 'light', 'dark')).toBe('dark')
  expect(getThemeName('dark', 'system', undefined)).toBe('dark')
})

it('keeps the stored choice in the social product', () => {
  expect(getThemeName('light', 'dark', 'dim')).toBe('dim')
  expect(getThemeName('dark', 'light', 'dim')).toBe('light')
})
