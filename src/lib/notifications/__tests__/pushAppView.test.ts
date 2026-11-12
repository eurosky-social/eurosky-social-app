import {type Client} from '@atproto/lex'
import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {
  pushAppViewDid,
  registeredPushAppView,
  registerPushWithAppView,
  unregisterPushForAccount,
} from '#/lib/notifications/pushAppView'
import {device} from '#/storage'

const BLUESKY = 'did:web:api.bsky.app'
const EUROSKY = 'did:web:api.eurosky.network'
const ALICE = {did: 'did:plc:alice', service: 'https://eurosky.social'}
const TOKEN = 'a1'.repeat(32)

function useEurosky() {
  device.set(['appViewOverride'], {
    url: 'https://api.eurosky.network',
    did: EUROSKY,
  })
}

/**
 * A client that records each call as [NSID, proxy service, input], failing
 * the calls whose NSID is in `failing`.
 */
function fakeClient(failing: Record<string, Error> = {}) {
  const calls: [string, string, Record<string, unknown>][] = []
  const call = jest.fn(
    (
      method: {$nsid?: string},
      input: Record<string, unknown>,
      options: {service: string},
    ) => {
      const id = String(method.$nsid)
      calls.push([id, options.service, input])
      const failure = failing[id]
      return failure ? Promise.reject(failure) : Promise.resolve({})
    },
  )
  return {client: {call} as unknown as Client, calls}
}

afterEach(() => {
  device.set(['appViewOverride'], undefined)
  device.set(['pushAppViews'], undefined)
})

describe('pushAppViewDid', () => {
  it('follows the content service chosen in settings', () => {
    expect(pushAppViewDid(ALICE.service)).toBe(BLUESKY)
    useEurosky()
    expect(pushAppViewDid(ALICE.service)).toBe(EUROSKY)
  })

  it('keeps Bluesky staging accounts on the staging AppView', () => {
    useEurosky()
    expect(pushAppViewDid('https://staging.bsky.dev')).toBe(
      'did:web:api.staging.bsky.dev',
    )
  })
})

describe('registerPushWithAppView', () => {
  it('registers with the selected AppView and remembers it', async () => {
    useEurosky()
    const {client, calls} = fakeClient()
    await registerPushWithAppView({
      client,
      account: ALICE,
      token: TOKEN,
      ageRestricted: false,
    })
    expect(calls).toEqual([
      [
        'app.bsky.notification.registerPush',
        `${EUROSKY}#bsky_notif`,
        expect.objectContaining({
          serviceDid: EUROSKY,
          token: TOKEN,
          appId: 'social.mu.app',
          ageRestricted: false,
        }),
      ],
    ])
    expect(registeredPushAppView(ALICE.did)).toBe(EUROSKY)
  })

  it('unregisters at the AppView the user switched away from', async () => {
    device.set(['pushAppViews'], {[ALICE.did]: EUROSKY})
    const {client, calls} = fakeClient()
    await registerPushWithAppView({
      client,
      account: ALICE,
      token: TOKEN,
      ageRestricted: false,
    })
    expect(calls.map(([id, service]) => [id, service])).toEqual([
      ['app.bsky.notification.unregisterPush', `${EUROSKY}#bsky_notif`],
      ['app.bsky.notification.registerPush', `${BLUESKY}#bsky_notif`],
    ])
    expect(registeredPushAppView(ALICE.did)).toBe(BLUESKY)
  })

  it('only registers when the AppView did not change', async () => {
    useEurosky()
    device.set(['pushAppViews'], {[ALICE.did]: EUROSKY})
    const {client, calls} = fakeClient()
    await registerPushWithAppView({
      client,
      account: ALICE,
      token: TOKEN,
      ageRestricted: true,
    })
    expect(calls.map(([id]) => id)).toEqual([
      'app.bsky.notification.registerPush',
    ])
  })

  it('tries the old AppView again next time when offline', async () => {
    device.set(['pushAppViews'], {[ALICE.did]: EUROSKY})
    const {client, calls} = fakeClient({
      'app.bsky.notification.unregisterPush': new TypeError(
        'Network request failed',
      ),
    })
    await registerPushWithAppView({
      client,
      account: ALICE,
      token: TOKEN,
      ageRestricted: false,
    })
    expect(calls.map(([id]) => id)).toContain(
      'app.bsky.notification.registerPush',
    )
    expect(registeredPushAppView(ALICE.did)).toBe(EUROSKY)
  })

  it('gives up on an old AppView that refuses the request', async () => {
    device.set(['pushAppViews'], {[ALICE.did]: 'did:web:gone.example'})
    const {client} = fakeClient({
      'app.bsky.notification.unregisterPush': new Error('UnknownServiceDid'),
    })
    await registerPushWithAppView({
      client,
      account: ALICE,
      token: TOKEN,
      ageRestricted: false,
    })
    expect(registeredPushAppView(ALICE.did)).toBe(BLUESKY)
  })

  it('keeps the other accounts on the device', async () => {
    device.set(['pushAppViews'], {'did:plc:bob': EUROSKY})
    const {client} = fakeClient()
    await registerPushWithAppView({
      client,
      account: ALICE,
      token: TOKEN,
      ageRestricted: false,
    })
    expect(device.get(['pushAppViews'])).toEqual({
      'did:plc:bob': EUROSKY,
      [ALICE.did]: BLUESKY,
    })
  })
})

describe('unregisterPushForAccount', () => {
  it('unregisters at the AppView the token was registered with', async () => {
    device.set(['pushAppViews'], {[ALICE.did]: EUROSKY})
    const {client, calls} = fakeClient()
    await unregisterPushForAccount({client, account: ALICE, token: TOKEN})
    expect(calls.map(([id, service]) => [id, service])).toEqual([
      ['app.bsky.notification.unregisterPush', `${EUROSKY}#bsky_notif`],
    ])
    expect(registeredPushAppView(ALICE.did)).toBeUndefined()
  })

  it('falls back to the current AppView without a record', async () => {
    useEurosky()
    const {client, calls} = fakeClient()
    await unregisterPushForAccount({client, account: ALICE, token: TOKEN})
    expect(calls[0]?.[1]).toBe(`${EUROSKY}#bsky_notif`)
  })
})
