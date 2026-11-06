import {describe, expect, it} from '@jest/globals'

import {
  assertProfileLinksUnchanged,
  hiddenLinkRefs,
  mergeLegacyWebsite,
  mergeSavedLinkRefs,
  planProfileLinksSave,
} from './legacy'
import {type OwnProfileLinks, type ProfileLink} from './types'

function snapshot(
  website = 'https://portfolio.example/',
  native: ProfileLink[] = [],
): OwnProfileLinks {
  const links = native.map((link, i) => ({
    ...link,
    uri: `at://did:plc:alice/app.bsky.actor.link/${i}`,
    cid: `cid-${i}`,
  }))
  const urls = links.map(link => link.url)
  return {
    links: mergeLegacyWebsite(links, website, urls, true),
    refs: links.map(link => ({uri: link.uri, cid: link.cid})),
    urls,
    website,
  }
}

describe('legacy website display', () => {
  it('appends the website without changing native links or writing fake refs', () => {
    const native = [
      {url: 'https://native.example/', title: 'Custom title', uri: 'native'},
    ]
    expect(mergeLegacyWebsite(native, 'portfolio.example', [])).toEqual([
      ...native,
      {url: 'https://portfolio.example/', legacyWebsite: 'portfolio.example'},
    ])
    expect(native).toHaveLength(1)
  })

  it('deduplicates normalized URLs and preserves the native title and icon', () => {
    const native = [
      {
        url: 'https://portfolio.example/',
        title: 'Portfolio',
        iconUrl: 'icon.png',
      },
    ]
    expect(
      mergeLegacyWebsite(native, 'https://PORTFOLIO.example', [native[0].url]),
    ).toEqual(native)
  })

  it('does not resurrect a native destination filtered by moderation or validation', () => {
    expect(
      mergeLegacyWebsite([], 'https://portfolio.example', [
        'https://portfolio.example/',
      ]),
    ).toEqual([])
  })

  it('keeps HTTP as HTTP, rather than silently upgrading it', () => {
    expect(mergeLegacyWebsite([], 'http://portfolio.example', [])[0].url).toBe(
      'http://portfolio.example/',
    )
  })

  it('keeps malformed values repairable by owners but never clickable by visitors', () => {
    expect(mergeLegacyWebsite([], 'not a URL', [])).toEqual([])
    expect(mergeLegacyWebsite([], 'not a URL', [], true)).toEqual([
      {url: 'not a URL', legacyWebsite: 'not a URL'},
    ])
    expect(mergeLegacyWebsite([], 'javascript:alert(1)', [])).toEqual([])
  })

  it('does not merge distinct paths, queries, fragments or schemes', () => {
    for (const native of [
      'https://portfolio.example/other',
      'https://portfolio.example/?q=1',
      'https://portfolio.example/#section',
      'http://portfolio.example/',
    ]) {
      expect(
        mergeLegacyWebsite([], 'https://portfolio.example/', [native]),
      ).toHaveLength(1)
    }
  })
})

describe('lossless migration plan', () => {
  it('moves a compatible website on save, preserving link order', () => {
    const original = snapshot('https://portfolio.example/', [
      {url: 'https://native.example/'},
    ])
    const ordered = [original.links[1], original.links[0]]
    const plan = planProfileLinksSave(original, ordered)
    expect(plan.website).toBeUndefined()
    expect(plan.links.map(link => link.url)).toEqual(
      ordered.map(link => link.url),
    )
    expect(plan.links.every(link => link.legacyWebsite === undefined)).toBe(
      true,
    )
    expect(original.website).toBe('https://portfolio.example/')
  })

  it.each([
    'http://portfolio.example/',
    'https://bit.ly/example',
    'https://videy.at/v/example',
    'invalid',
  ])('preserves an incompatible website: %s', website => {
    const original = snapshot(website)
    const plan = planProfileLinksSave(original, original.links)
    expect(plan.website).toBe(website)
    expect(plan.links).toEqual([])
  })

  it.each(['onlyfans.com', 'fansly.com'])(
    'migrates %s under the same URL policy as native links',
    domain => {
      const website = `https://${domain}/example`
      const original = snapshot(website)
      const plan = planProfileLinksSave(original, original.links)
      expect(plan.website).toBeUndefined()
      expect(plan.links).toEqual([{url: website, legacyWebsite: undefined}])
    },
  )

  it('retains an eleventh legacy entry until a slot becomes available', () => {
    const original = snapshot(
      'https://portfolio.example/',
      Array.from({length: 10}, (_, i) => ({
        url: `https://native.example/${i}`,
      })),
    )
    expect(original.links).toHaveLength(11)
    expect(planProfileLinksSave(original, original.links).website).toBe(
      original.website,
    )
    const plan = planProfileLinksSave(original, original.links.slice(1))
    expect(plan.website).toBeUndefined()
    expect(plan.links).toHaveLength(10)
  })

  it('counts and preserves refs that the owner parser did not expose', () => {
    const original = snapshot()
    original.refs = Array.from({length: 10}, (_, i) => ({
      uri: `hidden-${i}`,
      cid: `cid-${i}`,
    }))
    expect(hiddenLinkRefs(original)).toEqual(original.refs)
    const plan = planProfileLinksSave(original, original.links)
    expect(plan.website).toBe(original.website)
    expect(plan.preservedRefs).toEqual(original.refs)
  })

  it('retains hidden ref positions while applying visible reorders and migration', () => {
    const original = snapshot('https://portfolio.example/', [
      {url: 'https://a.example/'},
      {url: 'https://b.example/'},
    ])
    const [a, b] = original.refs
    const hidden = {uri: 'hidden', cid: 'hidden-cid'}
    const migrated = {uri: 'migrated', cid: 'new-cid'}
    original.refs = [a, hidden, b]
    expect(mergeSavedLinkRefs(original, [a, b, migrated])).toEqual([
      a,
      hidden,
      b,
      migrated,
    ])
    expect(mergeSavedLinkRefs(original, [b, a])).toEqual([b, hidden, a])
    expect(mergeSavedLinkRefs(original, [])).toEqual([hidden])
  })

  it('clears the old field when the owner explicitly removes or repairs the entry', () => {
    const original = snapshot('http://portfolio.example/')
    expect(planProfileLinksSave(original, []).website).toBeUndefined()
    const repaired = planProfileLinksSave(original, [
      {url: 'https://portfolio.example/', title: 'Portfolio'},
    ])
    expect(repaired.website).toBeUndefined()
    expect(repaired.links).toEqual([
      {url: 'https://portfolio.example/', title: 'Portfolio'},
    ])
  })

  it('cleans up an already represented website without creating a duplicate', () => {
    const original = snapshot('https://portfolio.example', [
      {url: 'https://portfolio.example/'},
    ])
    expect(original.links).toHaveLength(1)
    const plan = planProfileLinksSave(original, original.links)
    expect(plan.website).toBeUndefined()
    expect(plan.links).toEqual(original.links)
  })

  it('does not migrate for restricted accounts, but permits legacy removal', () => {
    const original = snapshot()
    expect(planProfileLinksSave(original, original.links, false).website).toBe(
      original.website,
    )
    expect(planProfileLinksSave(original, [], false).website).toBeUndefined()
  })

  it('rejects an explicit edit that would overflow rather than dropping a link', () => {
    const original = snapshot(
      '',
      Array.from({length: 10}, (_, i) => ({
        url: `https://native.example/${i}`,
      })),
    )
    expect(() =>
      planProfileLinksSave(original, [
        ...original.links,
        {url: 'https://extra.example/'},
      ]),
    ).toThrow('Too many')
  })
})

describe('concurrent profile edits', () => {
  it('permits unrelated profile edits and property-order differences', () => {
    const original = snapshot('https://portfolio.example/', [
      {url: 'https://native.example/'},
    ])
    expect(() =>
      assertProfileLinksUnchanged(original, {
        website: original.website,
        links: original.refs.map(ref => ({cid: ref.cid, uri: ref.uri})),
      }),
    ).not.toThrow()
  })

  it('rejects concurrent website, ref, order or CID changes', () => {
    const original = snapshot('https://portfolio.example/', [
      {url: 'https://a.example/'},
      {url: 'https://b.example/'},
    ])
    for (const changed of [
      {links: original.refs, website: 'https://new.example/'},
      {
        ...original,
        links: original.refs.map(ref => ({...ref, uri: `${ref.uri}-changed`})),
      },
      {...original, links: []},
      {...original, links: [...original.refs].reverse()},
      {...original, links: original.refs.map(ref => ({...ref, cid: 'new'}))},
    ]) {
      expect(() => assertProfileLinksUnchanged(original, changed)).toThrow(
        'Profile links changed',
      )
    }
  })
})
