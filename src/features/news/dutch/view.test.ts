import {describe, expect, it} from '@jest/globals'

import {
  decodeDutchThreadView,
  dutchThreadViewParams,
  encodeDutchThreadView,
  languagesForPlaces,
} from './view'

describe('languagesForPlaces', () => {
  it('adds a country’s own languages after the reader’s', () => {
    expect(languagesForPlaces(['en'], {countries: ['nl']})).toEqual([
      'en',
      'nl',
    ])
    expect(languagesForPlaces(['nl', 'en'], {countries: ['be']})).toEqual([
      'nl',
      'en',
      'fr',
    ])
  })

  it('adds a province’s country’s languages', () => {
    expect(languagesForPlaces(['en'], {category: 'nl-utrecht'})).toEqual([
      'en',
      'nl',
    ])
  })

  it('adds nothing for the world or an unknown place', () => {
    expect(languagesForPlaces(['en'], {})).toEqual(['en'])
    expect(languagesForPlaces(['en'], {countries: ['xx']})).toEqual(['en'])
  })

  it('keeps no language filter as none', () => {
    expect(languagesForPlaces(undefined, {countries: ['nl']})).toBeUndefined()
    expect(languagesForPlaces([], {countries: ['nl']})).toEqual([])
  })
})

describe('dutchThreadViewParams', () => {
  it('sends every language in the reader’s order, and the sets sorted', () => {
    expect(
      dutchThreadViewParams({
        languages: ['nl', 'en', 'nl'],
        countries: ['nl', 'be'],
        outlets: ['nos', 'hln'],
        boost: ['nu', 'ad'],
      }),
    ).toEqual({
      lang: 'nl,en',
      country: 'be,nl',
      outlet: 'hln,nos',
      boost: 'ad,nu',
      articles: 'matching',
    })
  })

  it('leaves out what the view does not ask for', () => {
    expect(dutchThreadViewParams({languages: []})).toEqual({
      lang: undefined,
      country: undefined,
      outlet: undefined,
      boost: undefined,
      articles: 'matching',
    })
  })
})

describe('encodeDutchThreadView', () => {
  it('is undefined for a view that asks for nothing', () => {
    expect(encodeDutchThreadView({})).toBeUndefined()
  })

  it('reads back as the same parameters', () => {
    const view = {languages: ['en', 'fr'], boost: ['nos', 'did:plc:abc']}
    expect(decodeDutchThreadView(encodeDutchThreadView(view))).toEqual(
      dutchThreadViewParams(view),
    )
  })
})

describe('decodeDutchThreadView', () => {
  it('ignores parameters a view does not carry', () => {
    expect(decodeDutchThreadView('scope=other&lang=en&limit=1')).toEqual({
      lang: 'en',
      country: undefined,
      outlet: undefined,
      boost: undefined,
      articles: 'matching',
    })
  })
})
