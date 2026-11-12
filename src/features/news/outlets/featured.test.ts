import {describe, expect, it, jest} from '@jest/globals'

import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {type DutchOutletDetail, type DutchOutletListing} from '../dutch/types'
import {parseRefs} from './config'
import {featuredForInterest, mergeFeaturedOutlets} from './featured'
import {type Newsroom} from './newsrooms'

/* The hooks are not under test; their modules pull in native-only state. */
jest.mock('#/state/session', () => ({}))
jest.mock('../dutch/queries', () => ({}))

function outlet(slug: string, did: string | null = null): DutchOutletDetail {
  return {
    slug,
    did,
    name: slug.toUpperCase(),
    country: 'nl',
    language: 'nl',
    kind: null,
    domains: [`${slug}.nl`],
  }
}

function newsroom(slug: string, did: string | null = null): Newsroom {
  return {
    slug,
    did,
    name: slug.toUpperCase(),
    handle: null,
    avatar: null,
    accent: null,
    domains: [`${slug}.com`],
    categories: [],
    reporterDids: [],
  }
}

describe('parseRefs', () => {
  it('splits on commas and whitespace, dropping blanks and repeats', () => {
    expect(parseRefs(' nos, nrc\n did:plc:abc ,,nos ')).toEqual([
      'nos',
      'nrc',
      'did:plc:abc',
    ])
    expect(parseRefs(undefined)).toEqual([])
    expect(parseRefs('')).toEqual([])
  })
})

describe('mergeFeaturedOutlets', () => {
  it('puts the configured outlets first, in their order', () => {
    const featured = mergeFeaturedOutlets(
      [outlet('nrc'), outlet('nos')],
      [newsroom('wired')],
    )
    expect(featured.map(o => [o.slug, o.source])).toEqual([
      ['nrc', 'config'],
      ['nos', 'config'],
      ['wired', 'newsroom'],
    ])
    expect(featured[0].site).toBe('nrc.nl')
  })

  it('skips configured outlets the aggregator does not know', () => {
    const featured = mergeFeaturedOutlets(
      [null, outlet('nos'), undefined],
      [newsroom('wired')],
    )
    expect(featured.map(o => o.slug)).toEqual(['nos', 'wired'])
  })

  it('fills up to the limit from the newsrooms', () => {
    const featured = mergeFeaturedOutlets(
      [outlet('nos')],
      [newsroom('wired'), newsroom('the-verge'), newsroom('nrc')],
      3,
    )
    expect(featured.map(o => o.slug)).toEqual(['nos', 'wired', 'the-verge'])
  })

  it('stops at the limit within the configured list', () => {
    const featured = mergeFeaturedOutlets(
      [outlet('nos'), outlet('nrc'), outlet('rtl')],
      [newsroom('wired')],
      2,
    )
    expect(featured.map(o => o.slug)).toEqual(['nos', 'nrc'])
  })

  it('features an outlet once, matched by slug or account', () => {
    const featured = mergeFeaturedOutlets(
      [outlet('nrc', 'did:plc:nrc')],
      [
        newsroom('nrc'),
        newsroom('nrc-handelsblad', 'did:plc:nrc'),
        newsroom('wired'),
      ],
    )
    expect(featured.map(o => [o.slug, o.source])).toEqual([
      ['nrc', 'config'],
      ['wired', 'newsroom'],
    ])
  })

  it('works with no publisher', () => {
    expect(mergeFeaturedOutlets([outlet('nos')], undefined)).toHaveLength(1)
    expect(mergeFeaturedOutlets([], undefined)).toEqual([])
  })
})

describe('featuredForInterest', () => {
  function listing(
    slug: string,
    country: string,
    themes?: Record<string, number>,
  ): DutchOutletListing {
    return {
      slug,
      did: null,
      name: slug,
      country,
      language: null,
      kind: null,
      domains: [`${slug}.example`],
      articles: 10,
      themes,
    }
  }
  function interest(overrides: Partial<NewsInterest> = {}): NewsInterest {
    return {
      id: 'i1',
      name: '',
      countries: [],
      subLocations: [],
      themes: [],
      excludedOutlets: [],
      strictOutlets: false,
      ...overrides,
    }
  }
  const OUTLETS = [
    listing('nos', 'nl', {politics: 2, sport: 5}),
    listing('nrc', 'nl', {politics: 6}),
    listing('ad', 'nl', {sport: 1}),
    listing('corriere', 'it', {politics: 9}),
  ]
  const slugs = (outlets: {slug: string}[]) => outlets.map(o => o.slug)

  it('keeps the interest’s places, busiest first', () => {
    expect(
      slugs(featuredForInterest(interest({countries: ['nl']}), OUTLETS, 3)),
    ).toEqual(['nos', 'nrc', 'ad'])
  })

  it('ranks and keeps by the interest’s themes', () => {
    expect(
      slugs(
        featuredForInterest(
          interest({countries: ['nl'], themes: ['sport']}),
          OUTLETS,
          3,
        ),
      ),
    ).toEqual(['nos', 'ad'])
  })

  it('leaves out unticked outlets and stops at the limit', () => {
    expect(
      slugs(
        featuredForInterest(
          interest({excludedOutlets: ['corriere']}),
          OUTLETS,
          2,
        ),
      ),
    ).toEqual(['nos', 'nrc'])
  })

  it('leads with the generally featured outlets', () => {
    expect(
      slugs(
        featuredForInterest(interest({countries: ['nl']}), OUTLETS, 3, ['ad']),
      ),
    ).toEqual(['ad', 'nos', 'nrc'])
  })
})
