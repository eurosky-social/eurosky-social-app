import {adaptThread} from '../dutch/adapt'
import {useDutchThreadQuery} from '../dutch/queries'
import {
  type ExploreArticle,
  type ExploreSourceId,
  type ExploreStory,
} from '../explore/cluster'
import {EXPLORE_SECTION_OTHER} from '../explore/sections'
import {useExploreStories} from '../explore/useExploreStories'

/**
 * Every article of the story an article was opened from, the article itself
 * included, so the article page can show the other newsrooms' takes.
 *
 * The Dutch labeler answers by thread with the thread's whole coverage. RSS
 * stories are clustered on the client, so they are found again in the same
 * clustering the spread ran (shared through the feed cache): by id, or, if the
 * feeds moved on and the cluster's lead changed, by the article being in it.
 */
export function useStoryCoverage({
  url,
  storyId,
  storySource,
  storyView,
}: {
  url: string
  storyId?: string
  storySource?: ExploreSourceId
  /** The view the Dutch labeler read the story in. */
  storyView?: string
}): {
  story?: Pick<ExploreStory, 'id' | 'source' | 'view'>
  coverage: ExploreArticle[]
  isLoading: boolean
} {
  const dutch = useDutchThreadQuery({
    id: storyId,
    view: storyView,
    enabled: storySource === 'dutch',
  })
  const rss = useExploreStories({enabled: storySource === 'rss' && !!storyId})

  if (storySource === 'dutch' && storyId) {
    /* The article page has no sections, so every article files under one. */
    const story = dutch.data
      ? adaptThread(dutch.data, () => EXPLORE_SECTION_OTHER, storyView)
      : undefined
    return {
      story: {id: storyId, source: 'dutch', view: storyView},
      coverage: story?.coverage ?? [],
      isLoading: dutch.isLoading,
    }
  }

  if (storySource === 'rss' && storyId) {
    const story =
      rss.stories.find(candidate => candidate.id === storyId) ??
      rss.stories.find(candidate =>
        candidate.coverage.some(article => article.item.link === url),
      )
    return {
      story: story ?? {id: storyId, source: 'rss'},
      coverage: story?.coverage ?? [],
      isLoading: rss.isLoading,
    }
  }

  return {coverage: [], isLoading: false}
}
