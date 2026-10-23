import {UnicodeString} from '@bsky/sdk/richtext'

import {BRAND} from '#/config/brand'
import {type app} from '#/lexicons'
import {router} from '#/routes'
import {type EventRecord} from './types'
import {
  getEventPostUrl,
  getEventShareUrls,
  hideEventLinks,
  makeEventLink,
} from './util'

describe('makeEventLink', () => {
  it('opens the event page with the DID and record key', () => {
    const link = makeEventLink({did: 'did:plc:abc', rkey: '3kxyz'})
    expect(router.matchPath(link)).toEqual([
      'Event',
      {name: 'did:plc:abc', rkey: '3kxyz'},
    ])
  })
})

describe('getEventPostUrl', () => {
  const event = {did: 'did:plc:abc', rkey: '3kxyz'} as EventRecord
  const profile = {did: 'did:plc:abc', handle: 'alice.test'}
  const host = `https://${BRAND.web.hosts[0]}`

  it("links to the event page on the brand's own site", () => {
    expect(getEventPostUrl(event, profile)).toBe(
      `${host}/events/alice.test/3kxyz`,
    )
  })

  it('falls back to the DID without a handle', () => {
    expect(getEventPostUrl(event)).toBe(`${host}/events/did:plc:abc/3kxyz`)
  })

  it('is listed among the share URLs in both forms', () => {
    const urls = getEventShareUrls(event, profile)
    expect(urls).toContain(`${host}/events/alice.test/3kxyz`)
    expect(urls).toContain(`${host}/events/did:plc:abc/3kxyz`)
  })
})

describe('hideEventLinks', () => {
  const eventUrl = 'https://atmo.rsvp/p/alice.test/e/3kxyz'
  const urls = [eventUrl, 'https://smokesignal.events/alice.test/3kxyz']

  function makePost({
    text,
    facets,
    embed,
  }: {
    text: string
    facets?: app.bsky.richtext.facet.Main[]
    embed?: app.bsky.feed.defs.PostView['embed']
  }) {
    return {
      uri: 'at://did:plc:bob/app.bsky.feed.post/1',
      cid: 'cid',
      author: {did: 'did:plc:bob', handle: 'bob.test'},
      record: {
        $type: 'app.bsky.feed.post',
        text,
        facets,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      embed,
      indexedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as app.bsky.feed.defs.PostView
  }

  function linkFacet(text: string, display: string, uri: string) {
    const start = new UnicodeString(text.slice(0, text.indexOf(display))).length
    return {
      index: {
        byteStart: start,
        byteEnd: start + new UnicodeString(display).length,
      },
      features: [{$type: 'app.bsky.richtext.facet#link', uri}],
    } as app.bsky.richtext.facet.Main
  }

  function recordOf(post: app.bsky.feed.defs.PostView) {
    return post.record as app.bsky.feed.post.Main
  }

  it('removes links to the event and keeps other facets in place', () => {
    const text = 'Going 🎉 atmo.rsvp/p/alice.test/e/3kxyz see example.com'
    const post = makePost({
      text,
      facets: [
        linkFacet(text, 'atmo.rsvp/p/alice.test/e/3kxyz', eventUrl),
        linkFacet(text, 'example.com', 'https://example.com'),
      ],
    })
    const record = recordOf(hideEventLinks(post, urls))
    expect(record.text).toBe('Going 🎉 see example.com')
    expect(record.facets).toHaveLength(1)
    const {byteStart, byteEnd} = record.facets![0].index
    expect(new UnicodeString(record.text).slice(byteStart, byteEnd)).toBe(
      'example.com',
    )
  })

  it('matches links regardless of case, trailing slash and query', () => {
    const text = 'Join me ATMO'
    const post = makePost({
      text,
      facets: [
        linkFacet(text, 'ATMO', 'https://ATMO.rsvp/p/Alice.test/e/3kxyz/?x=1'),
      ],
    })
    expect(recordOf(hideEventLinks(post, urls)).text).toBe('Join me')
  })

  it('removes a link card to the event', () => {
    const embed = {
      $type: 'app.bsky.embed.external#view',
      external: {uri: eventUrl, title: '', description: ''},
    } as app.bsky.feed.defs.PostView['embed']
    expect(hideEventLinks(makePost({text: 'hi', embed}), urls).embed).toBe(
      undefined,
    )
  })

  it('leaves posts without links to the event untouched', () => {
    const text = 'see example.com'
    const embed = {
      $type: 'app.bsky.embed.external#view',
      external: {uri: 'https://example.com', title: '', description: ''},
    } as app.bsky.feed.defs.PostView['embed']
    const post = makePost({
      text,
      facets: [linkFacet(text, 'example.com', 'https://example.com')],
      embed,
    })
    expect(hideEventLinks(post, urls)).toBe(post)
  })
})
