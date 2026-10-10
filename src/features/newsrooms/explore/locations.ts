import {NEWS_REGIONS, type NewsRegion} from '#/features/newsFeed/sources'
import {DUTCH_WORLD_SCOPE, IS_DUTCH_API_CONFIGURED} from '../dutch/config'
import {type useExploreSource} from './useExploreSource'

/** The news settings' region that stands for the whole page. */
export const WORLD_REGION = 'global'

type ExploreSourceArgs = Parameters<typeof useExploreSource>[0]

/**
 * The settings' countries the labeler can filter its world scope by, as the
 * ISO codes its outlets carry (`gb` for the UK).
 */
const COUNTRY_CODES: Record<string, string> = {
  belgium: 'be',
  france: 'fr',
  germany: 'de',
  netherlands: 'nl',
  spain: 'es',
  uk: 'gb',
}

/**
 * What the page reads to show a region on its own, or undefined where no
 * source can.
 *
 * Everything reads the labeler's world scope, the only one with a thread fit:
 * a scope without one answers `/api/threads` with no threads rather than an
 * error. A country is that scope narrowed to the threads its outlets covered.
 * A province is narrowed by its label value as the category, so the server
 * filters it and a province gets its own stories rather than whatever of the
 * national ones are placed there. Europe has no such filter. Without the
 * labeler there is only the world, read from RSS.
 */
export function sourceForRegion(id: string): ExploreSourceArgs | undefined {
  if (!IS_DUTCH_API_CONFIGURED) {
    return id === WORLD_REGION ? {source: 'rss'} : undefined
  }
  if (id === WORLD_REGION) {
    return {source: 'dutch', scope: DUTCH_WORLD_SCOPE}
  }
  const country = COUNTRY_CODES[id]
  if (country) {
    return {source: 'dutch', scope: DUTCH_WORLD_SCOPE, country}
  }
  const region = NEWS_REGIONS.find(r => r.id === id)
  if (region?.parent === 'netherlands') {
    return {source: 'dutch', scope: DUTCH_WORLD_SCOPE, category: id}
  }
  return undefined
}

/**
 * The regions the location picker offers: the world first, then the regions
 * picked in the news settings that the page can show on its own. With none of
 * those picked, it offers every region it can show.
 */
export function pickerRegions(selected: string[]): NewsRegion[] {
  const showable = NEWS_REGIONS.filter(
    region => region.id !== WORLD_REGION && sourceForRegion(region.id),
  )
  const picked = showable.filter(region => selected.includes(region.id))
  const world = NEWS_REGIONS.find(region => region.id === WORLD_REGION)!
  return [world, ...(picked.length > 0 ? picked : showable)]
}
