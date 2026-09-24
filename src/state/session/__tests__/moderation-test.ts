import {Client} from '@atproto/lex'
import {api, getPreferences} from '@bsky/sdk'
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

jest.mock('#/storage', () => ({
  account: {
    get: jest.fn(),
    set: jest.fn(),
  },
  device: {
    get: jest.fn(),
  },
}))

import {EUROSKY_LABELER_DID} from '#/lib/constants'
import {createLexClient} from '#/lib/lexClient'
import {account} from '#/storage'
import {configureGlobalAppLabelers} from '../additional-moderation-authorities'
import {
  applyLabelersToClient,
  configureModerationForAccount,
  configureModerationForGuest,
} from '../moderation'
import {asFetch, json, makeAccount, makeMockFetch} from './mock-fetch'

beforeEach(() => {
  jest.resetAllMocks()
  configureGlobalAppLabelers([])
})

afterEach(() => {
  configureGlobalAppLabelers([])
})

describe('configureModerationForAccount', () => {
  it('applies cached account labelers to appview and chat', () => {
    const appviewClient = {setLabelers: jest.fn()} as unknown as Client
    const chatClient = {setLabelers: jest.fn()} as unknown as Client
    jest
      .mocked(account.get)
      .mockReturnValue([
        'did:plc:account-labeler',
        api.moderation.did,
        EUROSKY_LABELER_DID,
      ])

    configureModerationForAccount(
      {appviewClient, chatClient},
      makeAccount({handle: 'alice.example.com'}),
    )

    expect(appviewClient.setLabelers).toHaveBeenCalledWith([
      'did:plc:account-labeler',
    ])
    expect(chatClient.setLabelers).toHaveBeenCalledWith([
      'did:plc:account-labeler',
    ])
    expect(Client.appLabelers).toEqual([
      api.moderation.did,
      EUROSKY_LABELER_DID,
    ])
  })

  it('enables both app labelers before the first preferences fetch', () => {
    const appviewClient = {setLabelers: jest.fn()} as unknown as Client
    const chatClient = {setLabelers: jest.fn()} as unknown as Client

    configureModerationForAccount(
      {appviewClient, chatClient},
      makeAccount({handle: 'alice.example.com'}),
    )

    expect(Client.appLabelers).toEqual([
      api.moderation.did,
      EUROSKY_LABELER_DID,
    ])
    expect(appviewClient.setLabelers).not.toHaveBeenCalled()
    expect(chatClient.setLabelers).not.toHaveBeenCalled()
  })
})

describe('configureModerationForGuest', () => {
  it('restores both default app labelers after a test session', () => {
    configureGlobalAppLabelers(['did:plc:test-labeler'])

    configureModerationForGuest()

    expect(Client.appLabelers).toEqual([
      api.moderation.did,
      EUROSKY_LABELER_DID,
    ])
  })

  it('includes both app labelers in SDK moderation preferences without subscribing', async () => {
    configureModerationForGuest()
    const fetchMock = makeMockFetch({
      'app.bsky.actor.getPreferences': () =>
        json({
          preferences: [
            {$type: 'app.bsky.actor.defs#savedFeedsPrefV2', items: []},
          ],
        }),
    })
    const client = createLexClient(
      {service: 'https://pds.example.com', fetch: asFetch(fetchMock)},
      {appLabelers: null},
    )

    const preferences = await client.call(getPreferences)

    expect(preferences.moderationPrefs.labelers).toEqual([
      {did: api.moderation.did, labels: {}},
      {did: EUROSKY_LABELER_DID, labels: {}},
    ])
  })
})

describe('applyLabelersToClient', () => {
  it('does not duplicate any global authority in account subscriptions', () => {
    const client = {setLabelers: jest.fn()} as unknown as Client
    const regionalLabeler = 'did:plc:regional-labeler'
    configureGlobalAppLabelers([
      api.moderation.did,
      EUROSKY_LABELER_DID,
      regionalLabeler,
    ])

    applyLabelersToClient(client, [
      api.moderation.did,
      EUROSKY_LABELER_DID,
      regionalLabeler,
      'did:plc:account-labeler',
    ])

    expect(client.setLabelers).toHaveBeenCalledWith(['did:plc:account-labeler'])
  })
})
