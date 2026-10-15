import {getNewsroomPublisherByDid} from '#/features/frontpages/legacy/publishers'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {findFrontpage, frontpagePath, useFrontpages} from './frontpages'

/** With the news hub, a frontpage is one of the news aggregator's outlets. */
function useAggregatorFrontpagePath(did: string): string | undefined {
  const {frontpages} = useFrontpages()
  const frontpage = findFrontpage(frontpages, did)
  return frontpage ? frontpagePath(frontpage) : undefined
}

/** Without it, a frontpage is one of the publishers registered in the app. */
function useRegisteredFrontpagePath(did: string): string | undefined {
  return getNewsroomPublisherByDid(did) ? `/frontpage/${did}` : undefined
}

/**
 * The path of the frontpage an account runs, if it runs one. Picked once per
 * build, so a build without the news hub never asks the aggregator.
 */
export const useProfileFrontpagePath = NEWS_V2_ENABLED
  ? useAggregatorFrontpagePath
  : useRegisteredFrontpagePath
