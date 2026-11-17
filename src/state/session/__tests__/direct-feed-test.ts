import {type Agent} from '@atproto/lex'
import {afterEach, describe, expect, it, jest} from '@jest/globals'

jest.mock('#/analytics/identifiers', () => ({
  getDeviceId: () => undefined,
  getSessionId: () => undefined,
}))

import {createLexClient} from '#/lib/lexClient'
import {app} from '#/lexicons'
import {withDirectFeed} from '../direct-feed'

const APPVIEW = {
  url: 'https://appview.example',
  did: 'did:web:appview.example',
} as const
const SERVICE = `${APPVIEW.did}#bsky_appview` as const
const FEED = 'at://did:plc:publisher/app.bsky.feed.generator/fu'

function setup() {
  const sessionFetch = jest
    .fn<Agent['fetchHandler']>()
    .mockImplementation(path =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            path.startsWith('/xrpc/com.atproto.server.getServiceAuth')
              ? {token: 'service-token'}
              : {did: 'did:plc:test', handle: 'test.example'},
          ),
          {headers: {'content-type': 'application/json'}},
        ),
      ),
    )
  const directFetch = jest.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({feed: []}), {
        headers: {'content-type': 'application/json'},
      }),
    ),
  )
  const agent = withDirectFeed(
    {did: 'did:plc:test', fetchHandler: sessionFetch},
    APPVIEW,
    directFetch,
  )
  const client = createLexClient(agent, {service: SERVICE})
  return {agent, client, sessionFetch, directFetch}
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('direct getFeed transport', () => {
  it('mints scoped auth on the PDS and preserves feed headers and pagination', async () => {
    const {client, sessionFetch, directFetch} = setup()
    const signal = new AbortController().signal
    await client.call(
      app.bsky.feed.getFeed,
      {feed: FEED, cursor: 'next', limit: 2},
      {
        signal,
        headers: {
          'accept-language': 'nl',
          'atproto-accept-labelers': 'did:plc:labeler',
          'x-atproto-device-id': 'device',
        },
      },
    )

    expect(sessionFetch).toHaveBeenCalledTimes(1)
    const [authPath, authInit] = sessionFetch.mock.calls[0]
    const authUrl = new URL(authPath, 'https://pds.example')
    expect(authUrl.pathname).toBe('/xrpc/com.atproto.server.getServiceAuth')
    expect(authUrl.searchParams.get('aud')).toBe(APPVIEW.did)
    expect(authUrl.searchParams.get('lxm')).toBe('app.bsky.feed.getFeed')
    expect(new Headers(authInit.headers).has('atproto-proxy')).toBe(false)

    const [url, init] = directFetch.mock.calls[0]
    const directUrl = new URL(url instanceof Request ? url.url : url)
    expect(directUrl.origin).toBe(APPVIEW.url)
    expect(directUrl.searchParams.get('cursor')).toBe('next')
    expect(directUrl.searchParams.get('feed')).toBe(FEED)
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer service-token')
    expect(headers.has('atproto-proxy')).toBe(false)
    expect(headers.get('accept-language')).toBe('nl')
    expect(headers.get('atproto-accept-labelers')).toBe('did:plc:labeler')
    expect(headers.get('x-atproto-device-id')).toBe('device')
    expect(init?.signal).toBe(signal)
    expect(init?.credentials).toBe('omit')
  })

  it('deduplicates concurrent minting and refreshes expiring tokens', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const {client, sessionFetch} = setup()
    await Promise.all([
      client.call(app.bsky.feed.getFeed, {feed: FEED}),
      client.call(app.bsky.feed.getFeed, {feed: FEED}),
    ])
    await client.call(app.bsky.feed.getFeed, {feed: FEED})
    expect(sessionFetch).toHaveBeenCalledTimes(1)
    now.mockReturnValue(1_700_000_280_000)
    await client.call(app.bsky.feed.getFeed, {feed: FEED})
    expect(sessionFetch).toHaveBeenCalledTimes(2)
  })

  it('leaves other methods and explicit alternate services on the PDS', async () => {
    const {client, sessionFetch, directFetch, agent} = setup()
    await client.call(app.bsky.actor.getProfile, {actor: 'test.example'})
    await agent.fetchHandler('/xrpc/app.bsky.feed.getFeed?limit=2', {
      headers: {'atproto-proxy': 'did:web:other.example#bsky_appview'},
    })
    expect(sessionFetch).toHaveBeenCalledTimes(2)
    expect(directFetch).not.toHaveBeenCalled()
  })

  it('does not dispatch an already aborted read', async () => {
    const {agent, sessionFetch, directFetch} = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(
      agent.fetchHandler('/xrpc/app.bsky.feed.getFeed', {
        signal: controller.signal,
        headers: {'atproto-proxy': SERVICE},
      }),
    ).rejects.toThrow()
    expect(sessionFetch).not.toHaveBeenCalled()
    expect(directFetch).not.toHaveBeenCalled()
  })

  it('surfaces auth failures and retries minting on the next read', async () => {
    const {client, sessionFetch, directFetch} = setup()
    sessionFetch.mockRejectedValueOnce(new Error('permission denied'))
    await expect(
      client.call(app.bsky.feed.getFeed, {feed: FEED}),
    ).rejects.toThrow()
    expect(directFetch).not.toHaveBeenCalled()
    await client.call(app.bsky.feed.getFeed, {feed: FEED})
    expect(sessionFetch).toHaveBeenCalledTimes(2)
    expect(directFetch).toHaveBeenCalledTimes(1)
  })
})
