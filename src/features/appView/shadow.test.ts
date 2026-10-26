import {type Service} from '@atproto/lex'
import {describe, expect, it, jest} from '@jest/globals'

import {BLUESKY_APPVIEW_SERVICE, BLUESKY_PUBLIC_APPVIEW} from '#/lib/constants'
import {type AppViewShadowConfig, withAppViewShadowFetch} from './shadow'

const TARGET_URL = 'https://api.eurosky.network'
const TARGET_SERVICE = 'did:web:api.eurosky.network#bsky_appview' as Service
const PDS_URL = 'https://pds.test'
const PATH = '/xrpc/app.bsky.actor.getProfile?actor=alice.test'

function config(percentage = 100): AppViewShadowConfig {
  return {
    percentage,
    targetUrl: new URL(TARGET_URL),
    targetService: TARGET_SERVICE,
  }
}

function resultListener() {
  let resolve!: (result: {
    outcome: 'success' | 'failure'
    nsid: string
    route: 'pds-proxy' | 'public'
    statusCode?: number
    failureType?: 'http' | 'network' | 'response-body' | 'timeout'
  }) => void
  const result = new Promise<Parameters<typeof resolve>[0]>(r => {
    resolve = r
  })
  return {result, onResult: resolve}
}

describe('authenticated AppView shadowing', () => {
  it('copies a prepared request without sending the response through the session', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    let shadowInput: unknown
    let shadowInit: RequestInit | undefined
    const shadowFetchMock = jest.fn(
      (input: unknown, init: RequestInit | undefined) => {
        shadowInput = input
        shadowInit = init
        return Promise.resolve(new Response('shadow'))
      },
    )
    const listener = resultListener()
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
      onResult: listener.onResult,
    })

    const response = await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {
        authorization: 'Bearer access-token',
        'atproto-proxy': BLUESKY_APPVIEW_SERVICE,
      },
    })

    expect(await response.text()).toBe('primary')
    expect(primaryFetchMock).toHaveBeenCalledTimes(1)
    expect(shadowFetchMock).toHaveBeenCalledTimes(1)
    expect(String(shadowInput)).toBe(`${PDS_URL}${PATH}`)
    const headers = new Headers(shadowInit?.headers)
    expect(headers.get('atproto-proxy')).toBe(TARGET_SERVICE)
    expect(headers.get('authorization')).toBe('Bearer access-token')
    await expect(listener.result).resolves.toEqual({
      outcome: 'success',
      nsid: 'app.bsky.actor.getProfile',
      route: 'pds-proxy',
      statusCode: 200,
    })
  })

  it('reports a non-success response without rejecting the primary call', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    const shadowFetchMock = jest.fn(() =>
      Promise.resolve(new Response('unavailable', {status: 503})),
    )
    const listener = resultListener()
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
      onResult: listener.onResult,
    })

    const response = await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {'atproto-proxy': BLUESKY_APPVIEW_SERVICE},
    })

    expect(await response.text()).toBe('primary')
    await expect(listener.result).resolves.toEqual({
      outcome: 'failure',
      nsid: 'app.bsky.actor.getProfile',
      route: 'pds-proxy',
      statusCode: 503,
      failureType: 'http',
    })
  })

  it('does not replay a one-use OAuth DPoP proof', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    const shadowFetchMock = jest.fn(() =>
      Promise.resolve(new Response('shadow')),
    )
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
    })

    await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {
        authorization: 'DPoP access-token',
        dpop: 'signed-proof',
        'atproto-proxy': BLUESKY_APPVIEW_SERVICE,
      },
    })

    expect(primaryFetchMock).toHaveBeenCalledTimes(1)
    expect(shadowFetchMock).not.toHaveBeenCalled()
  })

  it('never replays procedures or calls routed somewhere other than Bluesky', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    const shadowFetchMock = jest.fn(() =>
      Promise.resolve(new Response('shadow')),
    )
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
    })

    await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'POST',
      headers: {'atproto-proxy': BLUESKY_APPVIEW_SERVICE},
    })
    await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {'atproto-proxy': 'did:web:elsewhere.test#bsky_appview'},
    })

    expect(primaryFetchMock).toHaveBeenCalledTimes(2)
    expect(shadowFetchMock).not.toHaveBeenCalled()
  })

  it('samples each eligible read using the configured percentage', async () => {
    const primaryFetchMock = jest.fn(() => Promise.resolve(new Response('ok')))
    const shadowFetchMock = jest.fn(() =>
      Promise.resolve(new Response('shadow')),
    )
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(25),
      random: () => 0.25,
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
    })

    await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {'atproto-proxy': BLUESKY_APPVIEW_SERVICE},
    })

    expect(primaryFetchMock).toHaveBeenCalledTimes(1)
    expect(shadowFetchMock).not.toHaveBeenCalled()
  })

  it('aborts and reports a shadow request that exceeds its own timeout', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    let shadowWasAborted = false
    const shadowFetchMock = jest.fn(
      (_input: unknown, init: RequestInit | undefined) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              shadowWasAborted = true
              reject(Object.assign(new Error('aborted'), {name: 'AbortError'}))
            },
            {once: true},
          )
        }),
    )
    const listener = resultListener()
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
      timeoutMs: 5,
      onResult: listener.onResult,
    })

    const response = await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {'atproto-proxy': BLUESKY_APPVIEW_SERVICE},
    })

    expect(await response.text()).toBe('primary')
    await expect(listener.result).resolves.toEqual({
      outcome: 'failure',
      nsid: 'app.bsky.actor.getProfile',
      route: 'pds-proxy',
      failureType: 'timeout',
    })
    expect(shadowWasAborted).toBe(true)
  })

  it('bounds response-body consumption even if it ignores cancellation', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    const shadowResponse = new Response('shadow')
    jest
      .spyOn(shadowResponse, 'arrayBuffer')
      .mockImplementation(() => new Promise<ArrayBuffer>(() => {}))
    let shadowSignal: AbortSignal | null | undefined
    const shadowFetchMock = jest.fn(
      (_input: unknown, init: RequestInit | undefined) => {
        shadowSignal = init?.signal
        return Promise.resolve(shadowResponse)
      },
    )
    const listener = resultListener()
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
      timeoutMs: 5,
      onResult: listener.onResult,
    })

    await shadowed(new URL(`${PDS_URL}${PATH}`), {
      method: 'GET',
      headers: {'atproto-proxy': BLUESKY_APPVIEW_SERVICE},
    })

    await expect(listener.result).resolves.toEqual({
      outcome: 'failure',
      nsid: 'app.bsky.actor.getProfile',
      route: 'pds-proxy',
      statusCode: 200,
      failureType: 'timeout',
    })
    expect(shadowSignal?.aborted).toBe(true)
  })
})

describe('public AppView shadowing', () => {
  it('rewrites a Bluesky XRPC URL to the candidate and discards its response', async () => {
    const primaryFetchMock = jest.fn(() =>
      Promise.resolve(new Response('primary')),
    )
    let shadowInput: unknown
    const shadowFetchMock = jest.fn((input: unknown) => {
      shadowInput = input
      return Promise.resolve(new Response('shadow'))
    })
    const listener = resultListener()
    const shadowed = withAppViewShadowFetch(primaryFetchMock, {
      config: config(),
      shadowFetch: shadowFetchMock as unknown as typeof fetch,
      onResult: listener.onResult,
    })
    const source = new URL(`${BLUESKY_PUBLIC_APPVIEW}${PATH}`)

    const response = await shadowed(source, {method: 'GET'})

    expect(await response.text()).toBe('primary')
    expect(shadowFetchMock).toHaveBeenCalledTimes(1)
    expect(String(shadowInput)).toBe(`${TARGET_URL}${PATH}`)
    await expect(listener.result).resolves.toEqual({
      outcome: 'success',
      nsid: 'app.bsky.actor.getProfile',
      route: 'public',
      statusCode: 200,
    })
  })
})
