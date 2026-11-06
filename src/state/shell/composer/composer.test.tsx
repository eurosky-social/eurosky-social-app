import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, renderHook} from '@testing-library/react-native'

import {getProduct, PRODUCT} from '#/config/product'
import {Provider, useComposerState, useOpenComposer} from './index'

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('@lingui/react', () => ({useLingui: () => ({_: String})}))
jest.mock('#/state/gallery', () => ({purgeTemporaryImageFiles: jest.fn()}))
jest.mock('#/state/queries/resolve-link', () => ({
  precacheResolveLinkQuery: jest.fn(),
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

function wrapper({children}: React.PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Provider>{children}</Provider>
    </QueryClientProvider>
  )
}

afterEach(() => jest.restoreAllMocks())

it('guards direct provider calls, not just the authenticated hook', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const onClose = jest.fn()
  const {result} = renderHook(
    () => ({...useOpenComposer(), state: useComposerState()}),
    {wrapper},
  )
  act(() => result.current.openComposer({text: 'Root', onClose}))
  expect(result.current.state).toBeUndefined()
  expect(onClose).toHaveBeenCalledTimes(1)

  const reply = {replyTo: {uri: 'parent'} as never}
  act(() => result.current.openComposer(reply))
  expect(result.current.state).toEqual(reply)
})

it('preserves normal social composer opening', () => {
  const {result} = renderHook(
    () => ({...useOpenComposer(), state: useComposerState()}),
    {wrapper},
  )
  act(() => result.current.openComposer({text: 'Root'}))
  expect(result.current.state).toEqual({text: 'Root'})
})
