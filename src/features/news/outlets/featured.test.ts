import {describe, expect, it, jest} from '@jest/globals'

import {type DutchOutletDetail} from '../dutch/types'
import {parseRefs} from './config'
import {mergeFeaturedOutlets} from './featured'
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
