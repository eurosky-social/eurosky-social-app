import {IS_DUTCH_API_CONFIGURED} from '../dutch/config'
import {useDutchExploreStories} from '../dutch/useDutchExploreStories'
import {type ExploreSourceId, type ExploreStory} from './cluster'
import {EXPLORE_SECTION_OTHER, EXPLORE_SECTIONS} from './sections'
import {type ExploreSection} from './sections'
import {useExploreStories} from './useExploreStories'

/**
 * The stories a spread renders from the given source, plus the sections to lay
 * them out under.
 *
 * Both hooks run unconditionally to satisfy the rules of hooks; the one not
 * asked for fetches nothing. The Dutch source also stays idle where its API is
 * not configured (see ../dutch/config), and its page is not offered.
 */
export function useExploreSource({
  source,
  scope,
  theme,
  category,
  country,
  languages,
}: {
  source: ExploreSourceId
  /** For the Dutch source: which of the labeler's scopes to read. */
  scope?: string
  theme?: string
  /** For the Dutch source: a province label value, e.g. `nl-utrecht`. */
  category?: string
  /** For the Dutch source: an ISO country code, e.g. `fr`. */
  country?: string
  /**
   * For the Dutch source: ISO language codes the stories must be in. RSS
   * articles carry no language, so the RSS source ignores them.
   */
  languages?: string[]
}): {
  stories: ExploreStory[]
  /** In page order, ending with the catch-all the page files leftovers under. */
  sections: ExploreSection[]
  isLoading: boolean
  /** The source failed, as opposed to having nothing to show. */
  isError: boolean
} {
  const dutchActive = source === 'dutch' && IS_DUTCH_API_CONFIGURED
  const dutch = useDutchExploreStories({
    scope,
    theme,
    category,
    country,
    languages,
    enabled: dutchActive,
  })
  const rss = useExploreStories({enabled: source === 'rss'})

  if (source === 'dutch') {
    return {
      stories: dutch.stories,
      sections: [...dutch.sections, EXPLORE_SECTION_OTHER],
      isLoading: dutchActive && dutch.isLoading,
      isError: dutchActive && dutch.isError,
    }
  }

  return {
    stories: rss.stories,
    sections: [...EXPLORE_SECTIONS, EXPLORE_SECTION_OTHER],
    isLoading: rss.isLoading,
    /* Feeds that fail contribute nothing rather than failing the page. */
    isError: false,
  }
}
