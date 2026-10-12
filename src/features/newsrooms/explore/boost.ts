import {NEWS_REGIONS, selectSources} from '#/features/newsFeed/sources'
import {type NewsFeedPrefs} from '#/features/newsFeed/state/prefs'
import {type ExploreOutlet, type ExploreStory} from './cluster'

/**
 * How many places a story moves up for each kind of interest it matches. A
 * nudge rather than a sort: a matching story rises, but the day's biggest
 * story still leads unless the reader's interests are far down the page.
 */
const BOOST_POSITIONS = 8

/**
 * The news settings' topics as the sections they cover, across both sources:
 * the labeler's themes and the RSS spread's sections. `general` has no
 * counterpart, and `all` is no preference, so neither boosts anything.
 */
const TOPIC_SECTIONS: Record<string, string[]> = {
  politics: ['politics'],
  'arts-culture': ['culture'],
  sports: ['sport'],
  tech: ['tech'],
  climate: ['climate', 'environment'],
  health: ['health'],
  science: ['science', 'education'],
}

/**
 * The regions that have a section of their own. The Netherlands and its
 * provinces are matched on the labeler's own labels instead (see
 * `matchesRegion`); the other countries have no signal on a story yet, so they
 * boost only through their accounts.
 */
const REGION_SECTIONS: Record<string, string[]> = {
  global: ['world'],
  europe: ['europe'],
}

/** What the reader's news settings ask the page to boost. */
export type NewsInterests = {
  sectionIds: Set<string>
  /** Whether the reader picked the Netherlands. */
  dutch: boolean
  /** The Dutch provinces picked, as the labeler's label values. */
  provinces: Set<string>
  /**
   * The accounts the settings select, by DID and by handle. A news account's
   * handle is the outlet's own domain, which is how outlets with no account
   * link of their own are matched.
   */
  outlets: Set<string>
}

/** Undefined when the reader has no settings, which leaves the order alone. */
export function interestsFromPrefs(
  prefs: NewsFeedPrefs | null | undefined,
): NewsInterests | undefined {
  if (!prefs || prefs.topics.length === 0) return undefined

  const sectionIds = new Set([
    ...prefs.topics.flatMap(topic => TOPIC_SECTIONS[topic] ?? []),
    ...prefs.regions.flatMap(region => REGION_SECTIONS[region] ?? []),
  ])
  const outlets = new Set(
    selectSources(prefs).flatMap(source => [source.did, source.handle]),
  )

  return {
    sectionIds,
    dutch: prefs.regions.includes('netherlands'),
    provinces: new Set(
      prefs.regions.filter(id =>
        NEWS_REGIONS.some(
          region => region.id === id && region.parent === 'netherlands',
        ),
      ),
    ),
    outlets,
  }
}

/**
 * The stories reordered so those matching the reader's interests come
 * earlier. Each matching kind of interest - topic, region, account - counts
 * once, however many of the story's articles match it.
 */
export function boostStories<T extends ExploreStory>(
  stories: T[],
  interests: NewsInterests | undefined,
): T[] {
  if (!interests) return stories
  return (
    stories
      .map((story, index) => {
        const matches = matchCount(story, interests)
        return {story, matches, rank: index - BOOST_POSITIONS * matches}
      })
      /* On a tie the story that matched wins the place it was boosted to. */
      .sort((x, y) => x.rank - y.rank || y.matches - x.matches)
      .map(entry => entry.story)
  )
}

function matchCount(story: ExploreStory, interests: NewsInterests): number {
  let count = 0
  if (interests.sectionIds.has(story.section.id)) count += 1
  if (matchesRegion(story, interests)) count += 1
  if (
    story.coverage.some(article =>
      matchesOutlet(article.publisher, interests.outlets),
    )
  ) {
    count += 1
  }
  return count
}

/**
 * Whether the labeler places the story in a picked province, or, with the
 * Netherlands picked, marks it as Dutch at all: placed in any province, or
 * with an article in Dutch.
 */
function matchesRegion(story: ExploreStory, interests: NewsInterests): boolean {
  const regions = story.regions ?? []
  if (regions.some(region => interests.provinces.has(region))) return true
  return (
    interests.dutch &&
    (regions.length > 0 ||
      story.coverage.some(article =>
        article.item.categories?.includes('dutch'),
      ))
  )
}

function matchesOutlet(outlet: ExploreOutlet, outlets: Set<string>): boolean {
  if (outlet.did && outlets.has(outlet.did)) return true
  if (!outlet.site) return false
  /* A site on a subdomain of the account's domain is the same outlet. */
  const labels = outlet.site.split('.')
  return labels
    .slice(0, -1)
    .some((_, index) => outlets.has(labels.slice(index).join('.')))
}
