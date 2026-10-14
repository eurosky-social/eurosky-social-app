import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {getNewsroomPublisherByDid} from '#/features/newsrooms/legacy/publishers'
import {findNewsroom, newsroomPath, useNewsrooms} from './newsrooms'

/** With the news hub, a newsroom is one of the news aggregator's outlets. */
function useAggregatorNewsroomPath(did: string): string | undefined {
  const {newsrooms} = useNewsrooms()
  const newsroom = findNewsroom(newsrooms, did)
  return newsroom ? newsroomPath(newsroom) : undefined
}

/** Without it, a newsroom is one of the publishers registered in the app. */
function useRegisteredNewsroomPath(did: string): string | undefined {
  return getNewsroomPublisherByDid(did) ? `/newsroom/${did}` : undefined
}

/**
 * The path of the newsroom an account runs, if it runs one. Picked once per
 * build, so a build without the news hub never asks the aggregator.
 */
export const useProfileNewsroomPath = NEWS_V2_ENABLED
  ? useAggregatorNewsroomPath
  : useRegisteredNewsroomPath
