import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockEmitNetworkConfirmed = jest.fn()
const mockEmitNetworkLost = jest.fn()

jest.mock('#/state/events', () => ({
  emitNetworkConfirmed: mockEmitNetworkConfirmed,
  emitNetworkLost: mockEmitNetworkLost,
}))

async function withFreshNetwork(
  fetch: typeof globalThis.fetch,
  run: (networkAwareFetch: typeof globalThis.fetch) => Promise<void>,
): Promise<void> {
  const realFetch = globalThis.fetch
  globalThis.fetch = fetch
  try {
    await jest.isolateModulesAsync(async () => {
      const {networkAwareFetch} =
        require('../network') as typeof import('../network')
      await run(networkAwareFetch)
    })
  } finally {
    globalThis.fetch = realFetch
  }
}

describe('networkAwareFetch', () => {
  beforeEach(() => {
    mockEmitNetworkConfirmed.mockClear()
    mockEmitNetworkLost.mockClear()
  })

  it('does not report an explicitly aborted request as network loss', async () => {
    const abortError = Object.assign(new Error('aborted'), {name: 'AbortError'})
    const fetch = jest.fn(() =>
      Promise.reject(abortError),
    ) as unknown as typeof globalThis.fetch

    await withFreshNetwork(fetch, async networkAwareFetch => {
      await expect(networkAwareFetch('https://example.com')).rejects.toBe(
        abortError,
      )
    })

    expect(mockEmitNetworkConfirmed).not.toHaveBeenCalled()
    expect(mockEmitNetworkLost).not.toHaveBeenCalled()
  })

  it('continues to report other request failures as network loss', async () => {
    const networkError = new TypeError('Network request failed')
    const fetch = jest.fn(() =>
      Promise.reject(networkError),
    ) as unknown as typeof globalThis.fetch

    await withFreshNetwork(fetch, async networkAwareFetch => {
      await expect(networkAwareFetch('https://example.com')).rejects.toBe(
        networkError,
      )
    })

    expect(mockEmitNetworkLost).toHaveBeenCalledTimes(1)
  })
})
