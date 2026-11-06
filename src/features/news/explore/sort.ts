import {type DutchThreadSort} from '../dutch/types'
import {type ExploreStory} from './cluster'

/**
 * How the spread ranks its stories. `top` is each source's own sense of what
 * matters now: the labeler's `burst`, or for RSS the outlets running a story.
 * `latest` is newest first, whatever the coverage.
 */
export type ExploreSort = 'top' | 'latest'

/** The `/api/threads` sort a spread order asks the labeler for. */
export function dutchThreadSort(sort: ExploreSort): DutchThreadSort {
  return sort === 'latest' ? 'latest' : 'burst'
}

/**
 * The stories in the spread's order. `top` keeps the source's order. `latest`
 * sorts by the lead's time, the one the card shows, so the page reads newest
 * first down every column - including where several reads were merged rank by
 * rank, or the RSS clustering ranked by outlets. Stories with no time go last.
 */
export function sortStories(
  stories: ExploreStory[],
  sort: ExploreSort,
): ExploreStory[] {
  if (sort === 'top') return stories
  return [...stories].sort((x, y) => storyTime(y) - storyTime(x))
}

function storyTime(story: ExploreStory): number {
  const time = story.publishedAt ? new Date(story.publishedAt).getTime() : NaN
  return Number.isNaN(time) ? 0 : time
}
