import {type PropsWithChildren} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {BLUESKY_APPVIEW, BLUESKY_APPVIEW_DID} from '#/lib/constants'
import {useBeginAgeAssurance} from '#/ageAssurance/useBeginAgeAssurance'

const mockPdsClientCall = jest.fn()
const mockScopedClientCall = jest.fn()
const mockCreateLexClient = jest.fn((..._args: unknown[]) => ({
  call: mockScopedClientCall,
}))

jest.mock('#/lib/async/wait', () => ({
  wait: (_delay: number, fn: unknown) => fn,
}))
jest.mock('#/lib/lexClient', () => ({
  createLexClient: (...args: unknown[]) => mockCreateLexClient(...args),
}))
jest.mock('#/state/session', () => ({
  usePdsClient: () => ({call: mockPdsClientCall}),
}))
jest.mock('#/ageAssurance', () => ({
  usePatchAgeAssuranceServerState: () => jest.fn(),
}))
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: jest.fn()}),
}))
jest.mock('#/geolocation', () => ({
  useGeolocation: () => ({countryCode: 'gb', regionCode: undefined}),
}))
// A device with the Eurosky AppView preference selected (EUR-501)
jest.mock('#/storage', () => ({
  device: {
    get: () => ({
      url: 'https://api.eurosky.network',
      did: 'did:web:api.eurosky.network',
    }),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockPdsClientCall.mockResolvedValue({token: 'service-auth-token'})
  mockScopedClientCall.mockResolvedValue({})
})

function wrapper({children}: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: {mutations: {retry: false}},
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useBeginAgeAssurance', () => {
  it("targets Bluesky's AppView regardless of the AppView preference", async () => {
    const {result} = renderHook(() => useBeginAgeAssurance(), {wrapper})

    result.current.mutate({email: 'user@example.com', language: 'en'})

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPdsClientCall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({aud: BLUESKY_APPVIEW_DID}),
    )
    expect(mockCreateLexClient).toHaveBeenCalledWith(
      expect.objectContaining({service: BLUESKY_APPVIEW}),
      expect.anything(),
    )
  })
})
