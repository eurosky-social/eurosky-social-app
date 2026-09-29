import {IS_DUTCH_API_CONFIGURED} from '../dutch/config'
import {useDutchExploreStories} from '../dutch/useDutchExploreStories'
import {type ExploreStory} from './cluster'
import {EXPLORE_SECTION_OTHER, EXPLORE_SECTIONS} from './sections'
import {type ExploreSection} from './sections'
import {useExploreStories} from './useExploreStories'

/**
 * Where a spread's stories come from.
 *
 * - `rss` reads every registered publisher's feed and infers the structure -
 *   clustering headlines, matching categories to a fixed section list. This is
 *   Latest News.
 * - `dutch` is the Dutch labeler, which serves that structure already modeled:
 *   stories arrive clustered, themed, and carrying their matched discussion.
 *   It is the only source that knows which stories are regional, so it backs
 *   Local News.
 */
export type ExploreSourceId = 'rss' | 'dutch'

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
  theme,
  category,
}: {
  source: ExploreSourceId
  theme?: string
  category?: string
}): {
  stories: ExploreStory[]
  /** In page order, ending with the catch-all the page files leftovers under. */
  sections: ExploreSection[]
  isLoading: boolean
} {
  const dutchActive = source === 'dutch' && IS_DUTCH_API_CONFIGURED
  const dutch = useDutchExploreStories({theme, category, enabled: dutchActive})
  const rss = useExploreStories({enabled: source === 'rss'})

  if (source === 'dutch') {
    return {
      stories: dutch.stories,
      sections: [...dutch.sections, EXPLORE_SECTION_OTHER],
      isLoading: dutchActive && dutch.isLoading,
    }
  }

  return {
    stories: rss.stories,
    sections: [...EXPLORE_SECTIONS, EXPLORE_SECTION_OTHER],
    isLoading: rss.isLoading,
  }
}
