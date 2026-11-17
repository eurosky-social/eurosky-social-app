import {afterEach, describe, expect, it} from '@jest/globals'

import {device} from '#/storage'
import {withImageCdn} from './agent'
import {
  getImageCdn,
  getImageCdnOptionId,
  normalizeImageCdnUrl,
  rewriteImageCdnUrl,
  rewriteImageCdnUrlsInJson,
} from './config'

const CDN = 'https://cdn.example.com'
const AVATAR = 'https://cdn.bsky.app/img/avatar/plain/did:plc:abc/bafy@jpeg'

afterEach(() => {
  device.set(['imageCdnOverride'], undefined)
})

describe('image CDN configuration', () => {
  it('defaults to the Bluesky CDN and honours a device override', () => {
    expect(getImageCdn()).toBe('https://cdn.bsky.app')
    expect(getImageCdnOptionId(getImageCdn())).toBe('bluesky')

    device.set(['imageCdnOverride'], `${CDN}/`)
    expect(getImageCdn()).toBe(CDN)
    expect(getImageCdnOptionId(CDN)).toBe('custom')
  })

  it('ignores an invalid stored override', () => {
    device.set(['imageCdnOverride'], 'not a url')
    expect(getImageCdn()).toBe('https://cdn.bsky.app')
  })

  it('normalizes base URLs and keeps path prefixes', () => {
    expect(normalizeImageCdnUrl(' https://cdn.example.com/ ')).toBe(CDN)
    expect(normalizeImageCdnUrl('https://example.com/bsky/')).toBe(
      'https://example.com/bsky',
    )
    expect(() => normalizeImageCdnUrl('http://cdn.example.com')).toThrow(
      'https-required',
    )
    expect(() => normalizeImageCdnUrl('https://cdn.example.com/?a=1')).toThrow(
      'base-url-required',
    )
  })

  it('rewrites only Bluesky CDN image URLs', () => {
    expect(rewriteImageCdnUrl(AVATAR, CDN)).toBe(
      `${CDN}/img/avatar/plain/did:plc:abc/bafy@jpeg`,
    )
    expect(rewriteImageCdnUrl('https://other.example/img/a.png', CDN)).toBe(
      'https://other.example/img/a.png',
    )
    expect(rewriteImageCdnUrl('https://cdn.bsky.app/other', CDN)).toBe(
      'https://cdn.bsky.app/other',
    )
  })
})

describe('rewriteImageCdnUrlsInJson', () => {
  it('rewrites image fields but leaves free text alone', () => {
    const json = JSON.stringify({
      author: {avatar: AVATAR, banner: AVATAR},
      embed: {images: [{thumb: AVATAR, fullsize: AVATAR}]},
      record: {text: AVATAR, facets: [{uri: AVATAR}]},
      quoted: `see "avatar":"${AVATAR}"`,
    })
    const out = JSON.parse(rewriteImageCdnUrlsInJson(json, CDN)) as {
      author: unknown
      embed: {images: unknown[]}
      record: unknown
      quoted: string
    }
    const rewritten = rewriteImageCdnUrl(AVATAR, CDN)

    expect(out.author).toEqual({avatar: rewritten, banner: rewritten})
    expect(out.embed.images[0]).toEqual({thumb: rewritten, fullsize: rewritten})
    expect(out.record).toEqual({text: AVATAR, facets: [{uri: AVATAR}]})
    expect(out.quoted).toBe(`see "avatar":"${AVATAR}"`)
  })

  it('is a no-op for the Bluesky CDN', () => {
    const json = JSON.stringify({avatar: AVATAR})
    expect(rewriteImageCdnUrlsInJson(json, 'https://cdn.bsky.app')).toBe(json)
  })
})

describe('withImageCdn', () => {
  const agentReturning = (response: Response) =>
    withImageCdn({
      did: undefined,
      fetchHandler: () => Promise.resolve(response),
    })

  it('rewrites JSON responses when an override is set', async () => {
    device.set(['imageCdnOverride'], CDN)
    const res = await agentReturning(
      new Response(JSON.stringify({avatar: AVATAR}), {
        status: 200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      }),
    ).fetchHandler('/xrpc/x', {method: 'GET'})

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({avatar: rewriteImageCdnUrl(AVATAR, CDN)})
  })

  it('passes responses through untouched by default', async () => {
    const response = new Response(JSON.stringify({avatar: AVATAR}), {
      headers: {'content-type': 'application/json'},
    })
    const res = await agentReturning(response).fetchHandler('/xrpc/x', {
      method: 'GET',
    })
    expect(res).toBe(response)
  })
})
