import {afterEach, describe, expect, it} from '@jest/globals'

import {device} from '#/storage'
import {
  appViewUrlToDid,
  getAppViewDid,
  getAppViewProxyService,
  getPublicAppViewUrl,
  normalizeAppViewUrl,
  resolveCustomAppView,
} from './config'

afterEach(() => {
  device.set(['appViewOverride'], undefined)
})

describe('AppView configuration', () => {
  it('normalizes base URLs and derives their did:web identifier', () => {
    expect(normalizeAppViewUrl(' https://api.example.com/ ')).toBe(
      'https://api.example.com',
    )
    expect(appViewUrlToDid('https://api.example.com')).toBe(
      'did:web:api.example.com',
    )
  })

  it('rejects URL paths', () => {
    expect(() => normalizeAppViewUrl('https://api.example.com/xrpc')).toThrow(
      expect.objectContaining({code: 'base-url-required'}),
    )
  })

  it('verifies a custom AppView DID document', async () => {
    const fetcher = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'did:web:api.example.com',
            service: [
              {
                id: '#bsky_appview',
                type: 'BskyAppView',
                serviceEndpoint: 'https://api.example.com/',
              },
            ],
          }),
          {status: 200},
        ),
      )

    await expect(
      resolveCustomAppView('https://api.example.com', fetcher),
    ).resolves.toEqual({
      url: 'https://api.example.com',
      did: 'did:web:api.example.com',
    })
  })

  it('rejects a DID document without an AppView service', async () => {
    const fetcher = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({id: 'did:web:api.example.com', service: []}),
          {status: 200},
        ),
      )

    await expect(
      resolveCustomAppView('https://api.example.com', fetcher),
    ).rejects.toMatchObject({code: 'missing-appview-service'})
  })

  it('uses a valid stored override for authenticated and public requests', () => {
    device.set(['appViewOverride'], {
      url: 'https://api.example.com',
      did: 'did:web:api.example.com',
    })

    expect(getAppViewProxyService('did:web:default#bsky_appview')).toBe(
      'did:web:api.example.com#bsky_appview',
    )
    expect(getAppViewDid('did:web:default')).toBe('did:web:api.example.com')
    expect(getPublicAppViewUrl('https://public.default')).toBe(
      'https://api.example.com',
    )
  })
})
