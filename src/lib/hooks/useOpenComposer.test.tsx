import {renderHook} from '@testing-library/react-native'

import {getProduct, PRODUCT} from '#/config/product'
import {useOpenComposer} from './useOpenComposer'

const mockOpen = jest.fn()
const mockAuth = jest.fn((callback: (...args: unknown[]) => void) => callback)

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('#/state/shell/composer', () => ({
  useOpenComposer: () => ({openComposer: mockOpen}),
}))
jest.mock('#/lib/hooks/useRequireEmailVerification', () => ({
  useRequireEmailVerification:
    () =>
    (callback: (...args: unknown[]) => void) =>
    (...args: unknown[]) =>
      mockAuth(callback)(...args),
}))

afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it('keeps social compose behind the existing auth/email flow', () => {
  const {result} = renderHook(useOpenComposer)
  result.current.openComposer({text: 'Hello'})
  expect(mockAuth).toHaveBeenCalledTimes(1)
  expect(mockOpen).toHaveBeenCalledWith({text: 'Hello'})
})

it('blocks news root/quote actions before prompting authentication and releases resources', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const onClose = jest.fn()
  const {result} = renderHook(useOpenComposer)
  result.current.openComposer({text: 'Hello', onClose})
  result.current.openComposer({quote: {} as never})
  expect(mockAuth).not.toHaveBeenCalled()
  expect(mockOpen).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('retains news reply authentication and editing', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const {result} = renderHook(useOpenComposer)
  const reply = {replyTo: {uri: 'parent'} as never}
  result.current.openComposer(reply)
  result.current.openComposer({editPost: {uri: 'existing', text: 'Edit'}})
  expect(mockAuth).toHaveBeenCalledTimes(2)
  expect(mockOpen).toHaveBeenCalledWith(reply)
})
