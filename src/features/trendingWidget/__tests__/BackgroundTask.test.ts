import {app} from '#/lexicons'

let mockTask: (() => Promise<unknown>) | undefined
const mockBlueskyCall = jest.fn()
const mockConfiguredAppviewCall = jest.fn()
const mockUpdateSnapshot = jest.fn()

jest.mock('expo-task-manager', () => ({
  defineTask: (_name: string, task: () => Promise<unknown>) => {
    mockTask = task
  },
}))
jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: {Success: 'success', Failed: 'failed'},
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}))
jest.mock('@bsky.app/expo-bluesky-swiss-army', () => ({
  WidgetInfo: {isInstalled: () => Promise.resolve(true)},
}))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: () =>
    Promise.resolve(
      JSON.stringify({
        contentLanguages: ['en'],
        copy: {},
        interests: '',
        mutedWords: [],
      }),
    ),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))
jest.mock('#/state/session/clients', () => ({
  getPublicAppviewClient: () => ({call: mockConfiguredAppviewCall}),
  getPublicBlueskyAppviewClient: () => ({call: mockBlueskyCall}),
}))
jest.mock('#/state/queries/trending/useGetTrendsQuery', () => ({
  DEFAULT_FETCH_LIMIT: 20,
  filterTrends: (trends: unknown[]) => trends,
}))
jest.mock('#/features/trendingWidget/Snapshot', () => ({
  updateTrendingWidgetSnapshot: (...args: unknown[]) =>
    mockUpdateSnapshot(...args),
}))

require('#/features/trendingWidget/BackgroundTask.native')

describe('trending widget background refresh', () => {
  // Only Bluesky's AppView serves trends; Eurosky's answers "not implemented"
  // (EUR-651), so the widget must not use the configured public AppView.
  it("reads trends from Bluesky's public AppView", async () => {
    mockBlueskyCall.mockResolvedValue({trends: [], recIdStr: 'rec'})

    expect(await mockTask?.()).toBe('success')
    expect(mockBlueskyCall).toHaveBeenCalledWith(
      app.bsky.unspecced.getTrends,
      expect.anything(),
      expect.anything(),
    )
    expect(mockConfiguredAppviewCall).not.toHaveBeenCalled()
    expect(mockUpdateSnapshot).toHaveBeenCalled()
  })
})
