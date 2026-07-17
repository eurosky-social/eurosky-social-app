import {AtpAgent} from '@atproto/api'
import {describe, expect, it, jest} from '@jest/globals'

import {getPdsAgent} from '../pds-agent'

describe('getPdsAgent', () => {
  it('reuses an authenticated clone without the AppView proxy', async () => {
    const requestHeaders: Headers[] = []
    const fetch = jest.fn((input: unknown, init?: RequestInit) => {
      const inputHeaders =
        typeof input === 'object' && input && 'headers' in input
          ? (input.headers as HeadersInit)
          : undefined
      requestHeaders.push(new Headers(inputHeaders ?? init?.headers))
      return Promise.resolve(
        new Response(JSON.stringify({preferences: []}), {
          headers: {'content-type': 'application/json'},
          status: 200,
        }),
      )
    })
    const agent = new AtpAgent({
      service: 'https://pds.example',
      fetch,
    })
    agent.configureProxy('did:web:api.eurosky.network#bsky_appview')

    const pdsAgent = getPdsAgent(agent)
    expect(getPdsAgent(agent)).toBe(pdsAgent)

    await pdsAgent.app.bsky.actor.getPreferences().catch(() => undefined)
    expect(requestHeaders[0].has('atproto-proxy')).toBe(false)

    await agent.app.bsky.actor.getPreferences().catch(() => undefined)
    expect(agent.proxy).toBe('did:web:api.eurosky.network#bsky_appview')
    expect(requestHeaders).toHaveLength(2)
    expect(requestHeaders.at(-1)?.get('atproto-proxy')).toBe(
      'did:web:api.eurosky.network#bsky_appview',
    )
  })
})
