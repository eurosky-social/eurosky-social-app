import {type Agent} from '@atproto/lex'
import {afterEach, describe, expect, it} from '@jest/globals'

import {
  isAppViewDown,
  reportAppViewResult,
  resetAppViewHealth,
  withAppViewHealth,
} from './health'

const SERVICE = 'did:web:api.example.com#bsky_appview'

function agentReturning(result: () => Promise<Response>): Agent {
  return {did: undefined, fetchHandler: () => result()}
}

async function request(agent: Agent, proxy?: string) {
  const headers = proxy ? {'atproto-proxy': proxy} : undefined
  await agent.fetchHandler('/xrpc/x', {headers}).catch(() => {})
  /* Let the health observer attached to the response settle. */
  await Promise.resolve()
}

afterEach(() => {
  resetAppViewHealth()
})

describe('AppView health', () => {
  it('trips after five consecutive server errors', () => {
    for (let i = 0; i < 4; i++) reportAppViewResult(502)
    expect(isAppViewDown()).toBe(false)
    reportAppViewResult(null)
    expect(isAppViewDown()).toBe(true)
  })

  it('treats any answer below 500 as healthy', () => {
    for (let i = 0; i < 4; i++) reportAppViewResult(500)
    reportAppViewResult(400)
    for (let i = 0; i < 4; i++) reportAppViewResult(500)
    expect(isAppViewDown()).toBe(false)
  })

  it('counts only requests proxied to the AppView', async () => {
    const agent = withAppViewHealth(
      agentReturning(() => Promise.resolve(new Response(null, {status: 502}))),
      SERVICE,
    )
    for (let i = 0; i < 5; i++) await request(agent)
    for (let i = 0; i < 5; i++) await request(agent, 'did:web:chat#bsky_chat')
    expect(isAppViewDown()).toBe(false)
    for (let i = 0; i < 5; i++) await request(agent, SERVICE)
    expect(isAppViewDown()).toBe(true)
  })

  it('ignores proxied requests that never got a response', async () => {
    const agent = withAppViewHealth(
      agentReturning(() =>
        Promise.reject(new TypeError('Network request failed')),
      ),
      SERVICE,
    )
    for (let i = 0; i < 5; i++) await request(agent, SERVICE)
    expect(isAppViewDown()).toBe(false)
  })

  it('counts direct requests that never got a response', async () => {
    const agent = withAppViewHealth(
      agentReturning(() =>
        Promise.reject(new TypeError('Network request failed')),
      ),
    )
    for (let i = 0; i < 5; i++) await request(agent)
    expect(isAppViewDown()).toBe(true)
  })
})
