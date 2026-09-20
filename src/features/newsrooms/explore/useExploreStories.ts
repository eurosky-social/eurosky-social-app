import {useMemo} from 'react'

import {NEWSROOM_PUBLISHERS} from '../publishers'
import {useAllPublisherArticlesQuery} from '../queries'
import {clusterArticles, type ExploreStory} from './cluster'

/**
 * Every registered newsroom's latest articles, grouped into stories.
 *
 * Clustering compares each article against the others (see `clusterArticles`),
 * so it is memoized on the feed data rather than run on every render - the
 * query hook hands back fresh arrays each time, so its own identity cannot
 * carry the memo.
 */
export function useExploreStories(): {
  stories: ExploreStory[]
  isLoading: boolean
} {
  const {articlesByPublisher, isLoading} = useAllPublisherArticlesQuery({
    publishers: NEWSROOM_PUBLISHERS,
  })

  /*
   * One article id per publisher set is enough to know the feeds changed: the
   * ids are stable per fetch and reordering only happens with new articles.
   */
  const signature = articlesByPublisher
    .map(({publisher, articles}) => `${publisher.id}:${articles[0]?.id ?? ''}`)
    .join('|')

  /* Deliberately keyed on the signature rather than the array identity. */
  const stories = useMemo(
    () => clusterArticles(articlesByPublisher),
    [signature], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return {stories, isLoading}
}
