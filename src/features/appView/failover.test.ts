import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {device} from '#/storage'
import {APP_VIEW_PRESETS} from './config'
import {
  endAppViewFailoverIfRecovered,
  findAppViewFailover,
  getFailoverCandidates,
  probeAppView,
  saveAppViewFailover,
} from './failover'
import {type AppViewPreference} from './types'

const [BLUESKY, EUROSKY, BLACKSKY] = APP_VIEW_PRESETS

/** A probe that only the listed AppViews answer. */
function probeAnswering(...up: AppViewPreference[]) {
  return jest.fn((appView: AppViewPreference) =>
    Promise.resolve(up.some(item => item.did === appView.did)),
  ) as unknown as typeof probeAppView
}

afterEach(() => {
  device.set(['appViewOverride'], undefined)
  device.set(['appViewFailover'], undefined)
})

describe('AppView failover', () => {
  it('only offers Bluesky and Eurosky, never the failing AppView', () => {
    expect(getFailoverCandidates(BLUESKY).map(c => c.id)).toEqual(['eurosky'])
    expect(getFailoverCandidates(EUROSKY).map(c => c.id)).toEqual(['bluesky'])
    expect(getFailoverCandidates(BLACKSKY).map(c => c.id)).toEqual([
      'bluesky',
      'eurosky',
    ])
  })

  it('offers a candidate that answers while the active AppView does not', async () => {
    expect(
      await findAppViewFailover(undefined, probeAnswering(EUROSKY)),
    ).toMatchObject({id: 'eurosky'})
  })

  it('offers nothing when the active AppView still answers', async () => {
    expect(
      await findAppViewFailover(undefined, probeAnswering(BLUESKY, EUROSKY)),
    ).toBeUndefined()
  })

  it('offers nothing when no AppView answers', async () => {
    expect(
      await findAppViewFailover(undefined, probeAnswering()),
    ).toBeUndefined()
  })

  it('keeps the saved preference when failing over', () => {
    device.set(['appViewOverride'], EUROSKY)
    saveAppViewFailover(BLUESKY)
    expect(device.get(['appViewFailover'])).toEqual({
      url: BLUESKY.url,
      did: BLUESKY.did,
    })
    expect(device.get(['appViewOverride'])).toMatchObject({did: EUROSKY.did})
  })

  it('ends the failover instead of failing over to the preferred AppView', () => {
    device.set(['appViewFailover'], EUROSKY)
    saveAppViewFailover(BLUESKY)
    expect(device.get(['appViewFailover'])).toBeUndefined()
  })

  it('ends the failover only once the preferred AppView answers', async () => {
    device.set(['appViewFailover'], EUROSKY)
    await endAppViewFailoverIfRecovered(undefined, probeAnswering(EUROSKY))
    expect(device.get(['appViewFailover'])).toMatchObject({did: EUROSKY.did})
    await endAppViewFailoverIfRecovered(undefined, probeAnswering(BLUESKY))
    expect(device.get(['appViewFailover'])).toBeUndefined()
  })

  it('probes a signed-out AppView through its health endpoint', async () => {
    const fetcher = jest.fn(() =>
      Promise.resolve(new Response('{}', {status: 200})),
    )
    expect(
      await probeAppView(
        EUROSKY,
        undefined,
        fetcher as unknown as typeof fetch,
      ),
    ).toBe(true)
    expect(fetcher.mock.calls[0]).toEqual([
      'https://api.eurosky.network/xrpc/_health',
      expect.anything(),
    ])
  })

  it('probes a signed-in AppView through the account host', async () => {
    const call = jest.fn(() => Promise.resolve({}))
    const session = {client: {call} as never, did: 'did:plc:alice'}
    expect(await probeAppView(EUROSKY, session)).toBe(true)
    expect(call.mock.calls[0]).toEqual([
      expect.anything(),
      {actor: 'did:plc:alice'},
      expect.objectContaining({
        service: 'did:web:api.eurosky.network#bsky_appview',
      }),
    ])
    call.mockRejectedValueOnce(new Error('AccountTakedown'))
    expect(await probeAppView(EUROSKY, session)).toBe(false)
  })
})
