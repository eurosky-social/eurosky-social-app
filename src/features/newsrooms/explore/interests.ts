import {NEWS_REGIONS, type NewsRegion} from '#/features/newsFeed/sources'
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {type DutchThreadFilter} from '../dutch/queries'
import {type DutchOutletListing} from '../dutch/types'

/**
 * The places inside a country an interest can narrow to, by the country's ISO
 * code. Only the Netherlands has them: the aggregator labels its stories by
 * province, and their ids are those label values.
 */
export const SUB_LOCATIONS: Record<string, NewsRegion[]> = {
  nl: NEWS_REGIONS.filter(region => region.parent === 'netherlands'),
}

/** The country a sub-location is in, e.g. `nl` for `nl-utrecht`. */
export function countryOfSubLocation(id: string): string | undefined {
  return Object.keys(SUB_LOCATIONS).find(country =>
    SUB_LOCATIONS[country].some(region => region.id === id),
  )
}

/**
 * The outlets an interest picks from: those based in its countries, or every
 * outlet when it names none.
 */
export function outletsForInterest(
  interest: Pick<NewsInterest, 'countries'>,
  outlets: DutchOutletListing[],
): DutchOutletListing[] {
  if (interest.countries.length === 0) return outlets
  return outlets.filter(
    outlet => !!outlet.country && interest.countries.includes(outlet.country),
  )
}

/**
 * How many of the current stories in the themes an outlet ran an article in:
 * in any theme when none are given. Undefined where the service did not say,
 * so a caller can tell an outlet with nothing on the themes from one it
 * knows nothing about.
 */
export function outletCoverage(
  outlet: Pick<DutchOutletListing, 'themes'>,
  themes: string[],
): number | undefined {
  if (!outlet.themes) return undefined
  const counted =
    themes.length > 0
      ? themes.map(theme => outlet.themes![theme] ?? 0)
      : Object.values(outlet.themes)
  return counted.reduce((sum, count) => sum + count, 0)
}

/**
 * The reads of `/api/threads` that make up an interest, or `undefined` while
 * the outlets it narrows by are not known yet.
 *
 * The service takes several countries but one theme and one category per read,
 * so an interest is the cross of its places and its themes:
 * - its countries, all in one read, except those narrowed to sub-locations,
 *   which read one category each;
 * - each theme, or none for every theme.
 *
 * With outlets unticked, every read is limited to the ones left. Untick them
 * all and the interest reads nothing.
 */
export function filtersForInterest(
  interest: NewsInterest,
  outlets: DutchOutletListing[] | undefined,
): DutchThreadFilter[] | undefined {
  const narrowed = new Set(
    interest.subLocations
      .map(countryOfSubLocation)
      .filter((country): country is string => !!country),
  )
  const countries = interest.countries.filter(country => !narrowed.has(country))
  const places: DutchThreadFilter[] = [
    ...(countries.length > 0 ? [{countries}] : []),
    ...interest.subLocations.map(category => ({category})),
  ]
  if (places.length === 0) places.push({})

  let included: string[] | undefined
  if (interest.excludedOutlets.length > 0) {
    if (!outlets) return undefined
    included = outletsForInterest(interest, outlets)
      .map(outlet => outlet.slug)
      .filter(slug => !interest.excludedOutlets.includes(slug))
    if (included.length === 0) return []
  }

  const themes = interest.themes.length > 0 ? interest.themes : [undefined]
  return places.flatMap(place =>
    themes.map(theme => ({
      ...place,
      ...(theme ? {theme} : {}),
      ...(included ? {outlets: included} : {}),
    })),
  )
}

/**
 * Several ranked lists as one: the first of each, then the second of each,
 * and so on, keeping only the first sighting of an item.
 *
 * The lists come from separate reads, each ranked by the service, and the
 * scores behind those ranks are not served. Taking them rank by rank keeps
 * each list's order and lets no one read crowd out the others.
 */
export function mergeRanked<T extends {id: string}>(lists: T[][]): T[] {
  const seen = new Set<string>()
  const merged: T[] = []
  const longest = Math.max(0, ...lists.map(list => list.length))
  for (let rank = 0; rank < longest; rank++) {
    for (const list of lists) {
      const item = list[rank]
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }
  return merged
}
