import {IS_DUTCH_API_CONFIGURED} from '../dutch/config'
import {useDutchExploreStories} from '../dutch/useDutchExploreStories'
import {type ExploreStory} from './cluster'
import {EXPLORE_SECTION_OTHER, EXPLORE_SECTIONS} from './sections'
import {type ExploreSection} from './sections'
import {useExploreStories} from './useExploreStories'

/**
 * The stories the spread renders, from whichever source this build is set up
 * for, plus the sections to lay them out under.
 *
 * Two sources answer the same question differently. The RSS source reads every
 * registered publisher's feed and infers the structure - clustering headlines,
 * matching categories to a fixed section list. The Dutch labeler serves that
 * structure already modeled, so its stories arrive clustered, themed, and
 * carrying their matched discussion.
 *
 * Which one is live is configuration, not a user choice: the Dutch source takes
 * over wherever its API is configured (see ../dutch/config). Both hooks run
 * unconditionally to satisfy the rules of hooks; the inactive one fetches
 * nothing.
 */
export function useExploreSource({
  theme,
  category,
}: {theme?: string; category?: string} = {}): {
  stories: ExploreStory[]
  /** In page order, ending with the catch-all the page files leftovers under. */
  sections: ExploreSection[]
  isLoading: boolean
} {
  const dutch = useDutchExploreStories({theme, category})
  const rss = useExploreStories({enabled: !IS_DUTCH_API_CONFIGURED})

  if (IS_DUTCH_API_CONFIGURED) {
    return {
      stories: dutch.stories,
      sections: [...dutch.sections, EXPLORE_SECTION_OTHER],
      isLoading: dutch.isLoading,
    }
  }

  return {
    stories: rss.stories,
    sections: [...EXPLORE_SECTIONS, EXPLORE_SECTION_OTHER],
    isLoading: rss.isLoading,
  }
}
