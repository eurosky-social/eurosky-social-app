import {describe, expect, it} from '@jest/globals'

import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {type DutchOutletListing} from '../dutch/types'
import {
  countryOfSubLocation,
  filtersForInterest,
  mergeRanked,
  outletCoverage,
  outletsForInterest,
} from './interests'

function interest(overrides: Partial<NewsInterest> = {}): NewsInterest {
  return {
    id: 'i1',
    name: '',
    countries: [],
    subLocations: [],
    themes: [],
    excludedOutlets: [],
    ...overrides,
  }
}

function outlet(slug: string, country: string | null): DutchOutletListing {
  return {
    slug,
    did: null,
    name: slug,
    country,
    language: null,
    kind: null,
    domains: [`${slug}.example`],
    articles: 10,
  }
}

const OUTLETS = [
  outlet('le-soir', 'be'),
  outlet('hln', 'be'),
  outlet('nos', 'nl'),
  outlet('bbc', 'gb'),
]

describe('countryOfSubLocation', () => {
  it('finds the country of a Dutch province', () => {
    expect(countryOfSubLocation('nl-utrecht')).toBe('nl')
    expect(countryOfSubLocation('nowhere')).toBeUndefined()
  })
})

describe('outletsForInterest', () => {
  it('keeps the outlets of the interest’s countries', () => {
    expect(
      outletsForInterest(interest({countries: ['be']}), OUTLETS).map(
        o => o.slug,
      ),
    ).toEqual(['le-soir', 'hln'])
  })

  it('offers every outlet to an interest with no place', () => {
    expect(outletsForInterest(interest(), OUTLETS)).toHaveLength(4)
  })
})

describe('outletCoverage', () => {
  const covering = {themes: {tech: 4, politics: 2}}

  it('counts the stories in the given themes', () => {
    expect(outletCoverage(covering, ['tech'])).toBe(4)
    expect(outletCoverage(covering, ['tech', 'sport'])).toBe(4)
    expect(outletCoverage(covering, ['sport'])).toBe(0)
  })

  it('counts every theme when none are given', () => {
    expect(outletCoverage(covering, [])).toBe(6)
  })

  it('is undefined when the service did not say', () => {
    expect(outletCoverage({}, ['tech'])).toBeUndefined()
  })
})

describe('filtersForInterest', () => {
  it('reads everything for an interest with no filters', () => {
    expect(filtersForInterest(interest(), OUTLETS)).toEqual([{}])
  })

  it('reads one theme anywhere: “Tech”', () => {
    expect(filtersForInterest(interest({themes: ['tech']}), OUTLETS)).toEqual([
      {theme: 'tech'},
    ])
  })

  it('reads all its countries at once', () => {
    expect(
      filtersForInterest(interest({countries: ['be', 'fr']}), OUTLETS),
    ).toEqual([{countries: ['be', 'fr']}])
  })

  it('crosses its places with its themes, one theme per read', () => {
    expect(
      filtersForInterest(
        interest({countries: ['be'], themes: ['tech', 'sport']}),
        OUTLETS,
      ),
    ).toEqual([
      {countries: ['be'], theme: 'tech'},
      {countries: ['be'], theme: 'sport'},
    ])
  })

  it('narrows a country to its picked sub-locations, one read each', () => {
    expect(
      filtersForInterest(
        interest({
          countries: ['be', 'nl'],
          subLocations: ['nl-utrecht', 'nl-drenthe'],
        }),
        OUTLETS,
      ),
    ).toEqual([
      {countries: ['be']},
      {category: 'nl-utrecht'},
      {category: 'nl-drenthe'},
    ])
  })

  it('limits every read to the outlets left ticked', () => {
    expect(
      filtersForInterest(
        interest({countries: ['be'], excludedOutlets: ['hln']}),
        OUTLETS,
      ),
    ).toEqual([{countries: ['be'], outlets: ['le-soir']}])
  })

  it('waits for the outlets when some are unticked', () => {
    expect(
      filtersForInterest(interest({excludedOutlets: ['hln']}), undefined),
    ).toBeUndefined()
  })

  it('reads nothing with every outlet unticked', () => {
    expect(
      filtersForInterest(
        interest({countries: ['be'], excludedOutlets: ['hln', 'le-soir']}),
        OUTLETS,
      ),
    ).toEqual([])
  })
})

describe('mergeRanked', () => {
  const items = (...ids: string[]) => ids.map(id => ({id}))

  it('takes the lists rank by rank, each item once', () => {
    expect(
      mergeRanked([items('a', 'b', 'c'), items('x', 'a', 'y')]).map(i => i.id),
    ).toEqual(['a', 'x', 'b', 'c', 'y'])
  })

  it('is empty with nothing to merge', () => {
    expect(mergeRanked([])).toEqual([])
  })
})
