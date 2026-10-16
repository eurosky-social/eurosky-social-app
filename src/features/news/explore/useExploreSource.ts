import {IS_DUTCH_API_CONFIGURED} from '../dutch/config'
import {type DutchThreadFilter} from '../dutch/queries'
import {useDutchExploreStories} from '../dutch/useDutchExploreStories'
import {type ExploreSourceId, type ExploreStory} from './cluster'
import {EXPLORE_SECTION_OTHER, EXPLORE_SECTIONS} from './sections'
import {type ExploreSection} from './sections'
import {useExploreStories} from './useExploreStories'

/** One read of the whole scope. */
const EVERYTHING: DutchThreadFilter[] = [{}]

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
  filters = EVERYTHING,
  languages,
}: {
  source: ExploreSourceId
  /** For the Dutch source: which of the labeler's scopes to read. */
  scope?: string
  /**
   * For the Dutch source: the reads that make up the page, merged into one.
   * Unset reads the whole scope; empty reads nothing.
   */
  filters?: DutchThreadFilter[]
  /**
   * For the Dutch source: ISO language codes the stories must be in, and the
   * only languages of their articles shown. RSS articles carry no language,
   * so the RSS source ignores them.
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
    filters,
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
