import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {BRAND} from '#/config/brand'
import {router} from '#/routes'
import {hasSupporterEntitlement} from './records'
import {createSupporterQueryKey, useIsSupporter} from './useSupporter'

jest.mock('#/config/brand', () => ({
  BRAND: {decorations: {enabled: true, subscriberListUris: []}},
}))
jest.mock('./records', () => ({hasSupporterEntitlement: jest.fn()}))

const did = 'did:plc:supporter'
const list = 'at://did:plc:issuer/app.bsky.graph.list/supporters'
const config = BRAND.decorations as {
  enabled: boolean
  subscriberListUris: string[]
}
let client: QueryClient

function wrapper({children}: {children: React.ReactNode}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  jest.resetAllMocks()
  config.enabled = true
  config.subscriberListUris = [list]
  client = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: Infinity}},
  })
})
afterEach(() => client.clear())

it('shares a membership lookup for repeated appearances of a profile', async () => {
  jest.mocked(hasSupporterEntitlement).mockResolvedValue(true)
  const {result} = renderHook(
    () => [useIsSupporter(did), useIsSupporter(did)],
    {wrapper},
  )
  await waitFor(() => expect(result.current).toEqual([true, true]))
  expect(hasSupporterEntitlement).toHaveBeenCalledTimes(1)
  expect(hasSupporterEntitlement).toHaveBeenCalledWith(did, [list])
})

it('hides cached badges and makes no requests when disabled', () => {
  client.setQueryData(createSupporterQueryKey(did), true)
  config.enabled = false
  const {result} = renderHook(() => useIsSupporter(did), {wrapper})
  expect(result.current).toBe(false)
  expect(hasSupporterEntitlement).not.toHaveBeenCalled()
})

it('does not query without a DID or configured lists', () => {
  const {result} = renderHook(() => useIsSupporter(undefined), {wrapper})
  expect(result.current).toBe(false)
  config.subscriberListUris = []
  const emptyLists = renderHook(() => useIsSupporter(did), {wrapper})
  expect(emptyLists.result.current).toBe(false)
  expect(hasSupporterEntitlement).not.toHaveBeenCalled()
})

it('does not reuse entitlement cached for different trusted lists', async () => {
  client.setQueryData(createSupporterQueryKey(did), true)
  config.subscriberListUris = [`${list}-test`]
  jest.mocked(hasSupporterEntitlement).mockResolvedValue(false)
  const {result, unmount} = renderHook(() => useIsSupporter(did), {wrapper})
  expect(result.current).toBe(false)
  await waitFor(() =>
    expect(client.getQueryState(createSupporterQueryKey(did))?.status).toBe(
      'success',
    ),
  )
  expect(hasSupporterEntitlement).toHaveBeenCalledWith(did, [`${list}-test`])
  expect(result.current).toBe(false)
  unmount()
})

it('keeps old checkout redirects working while using the new supporter route', () => {
  expect(router.matchName('SupporterSettings')?.build()).toBe(
    '/settings/supporter',
  )
  expect(router.matchPath('/settings/supporter')[0]).toBe('SupporterSettings')
  expect(router.matchPath('/settings/decorations?checkout=return')).toEqual([
    'SupporterSettings',
    {checkout: 'return'},
  ])
})
