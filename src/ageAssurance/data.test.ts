import {type Client} from '@atproto/lex'

import {BLUESKY_APPVIEW_SERVICE} from '#/lib/constants'
import {getConfig, getServerState} from '#/ageAssurance/data'
import {app} from '#/lexicons'

const mockPublicAppviewCall = jest.fn()
const mockPublicBlueskyAppviewCall = jest.fn()

jest.mock('#/state/session/clients', () => ({
  getPublicAppviewClient: () => ({call: mockPublicAppviewCall}),
  getPublicBlueskyAppviewClient: () => ({call: mockPublicBlueskyAppviewCall}),
}))
jest.mock('#/state/session', () => ({}))
jest.mock('#/state/queries/messages/actor-declaration', () => ({}))
jest.mock('#/ageAssurance/muAgeService', () => ({}))
jest.mock('#/storage', () => ({
  device: {
    get: () => ({countryCode: 'GB', regionCode: undefined}),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('age assurance reads', () => {
  it("fetches config from Bluesky's AppView", async () => {
    mockPublicBlueskyAppviewCall.mockResolvedValue({regions: []})

    await getConfig()

    expect(mockPublicBlueskyAppviewCall).toHaveBeenCalledWith(
      app.bsky.ageassurance.getConfig,
    )
    expect(mockPublicAppviewCall).not.toHaveBeenCalled()
  })

  it("proxies getState to Bluesky's AppView, overriding the session AppView", async () => {
    const call = jest.fn().mockResolvedValue({state: {status: 'assured'}})
    const appviewClient = {did: 'did:plc:alice', call} as unknown as Client

    await getServerState({appviewClient})

    expect(call).toHaveBeenCalledWith(
      app.bsky.ageassurance.getState,
      {countryCode: 'GB', regionCode: undefined},
      {service: BLUESKY_APPVIEW_SERVICE},
    )
  })
})
