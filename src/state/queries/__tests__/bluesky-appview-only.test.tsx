import {type PropsWithChildren} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {BLUESKY_APPVIEW_SERVICE} from '#/lib/constants'
import {useGetTrendsQuery} from '#/state/queries/trending/useGetTrendsQuery'
import {useOnboardingSuggestedStarterPacksQuery} from '#/state/queries/useOnboardingSuggestedStarterPacksQuery'
import {useSuggestedStarterPacksQuery} from '#/state/queries/useSuggestedStarterPacksQuery'
import {useAppviewClient, useBlueskyAppviewRequestTarget} from '#/state/session'
import {app} from '#/lexicons'

jest.mock('#/state/session', () => ({
  useAppviewClient: jest.fn(),
  useBlueskyAppviewRequestTarget: jest.fn(),
}))
jest.mock('#/state/queries/preferences', () => ({
  usePreferencesQuery: () => ({
    data: {moderationPrefs: {mutedWords: []}, interests: {tags: []}},
  }),
}))
jest.mock('#/state/preferences/languages', () => ({
  getContentLanguages: () => ['en'],
}))

// Trends and starter-pack suggestions come from Bluesky's topics service.
// Other AppViews, including Eurosky's, answer these calls with "not
// implemented", so they must reach Bluesky's AppView whatever AppView the user
// picked (EUR-651).
const blueskyCall = jest.fn()
const configuredAppviewCall = jest.fn()

function setup<T>(useHook: () => T) {
  jest.mocked(useBlueskyAppviewRequestTarget).mockReturnValue({
    client: {call: blueskyCall},
    service: BLUESKY_APPVIEW_SERVICE,
  } as never)
  jest
    .mocked(useAppviewClient)
    .mockReturnValue({call: configuredAppviewCall} as never)
  const queryClient = new QueryClient({
    defaultOptions: {queries: {gcTime: Infinity, retry: false}},
  })
  const wrapper = ({children}: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(useHook, {wrapper})
}

beforeEach(() => jest.clearAllMocks())

describe("queries only Bluesky's AppView can answer", () => {
  it("asks Bluesky's AppView for trends", async () => {
    blueskyCall.mockResolvedValue({trends: [], recIdStr: 'rec'})
    const {result} = setup(() => useGetTrendsQuery())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(blueskyCall).toHaveBeenCalledWith(
      app.bsky.unspecced.getTrends,
      expect.anything(),
      expect.objectContaining({service: BLUESKY_APPVIEW_SERVICE}),
    )
    expect(configuredAppviewCall).not.toHaveBeenCalled()
  })

  it("asks Bluesky's AppView for suggested starter packs", async () => {
    blueskyCall.mockResolvedValue({starterPacks: [], recIdStr: 'rec'})
    const {result} = setup(() => useSuggestedStarterPacksQuery({}))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(blueskyCall).toHaveBeenCalledWith(
      app.bsky.unspecced.getSuggestedStarterPacks,
      expect.anything(),
      expect.objectContaining({service: BLUESKY_APPVIEW_SERVICE}),
    )
    expect(configuredAppviewCall).not.toHaveBeenCalled()
  })

  it("asks Bluesky's AppView for onboarding starter packs", async () => {
    blueskyCall.mockResolvedValue({starterPacks: [], recIdStr: 'rec'})
    const {result} = setup(() => useOnboardingSuggestedStarterPacksQuery({}))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(blueskyCall).toHaveBeenCalledWith(
      app.bsky.unspecced.getOnboardingSuggestedStarterPacks,
      expect.anything(),
      expect.objectContaining({service: BLUESKY_APPVIEW_SERVICE}),
    )
    expect(configuredAppviewCall).not.toHaveBeenCalled()
  })
})
