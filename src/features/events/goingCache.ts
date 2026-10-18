import {type InfiniteData, type QueryClient} from '@tanstack/react-query'

import {type app} from '#/lexicons'

/**
 * Query key root of the "going" lists. Kept apart from queries.ts so the
 * profile shadow cache can import the lookup below without pulling in the
 * events feature.
 */
export const eventGoingQueryKeyRoot = 'eventGoing'

/**
 * Profiles in the "going" lists, so follow state changes (profile shadows)
 * reach them and their follow buttons update.
 */
export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<app.bsky.actor.defs.ProfileViewDetailed, void> {
  const queryDatas = queryClient.getQueriesData<
    InfiniteData<{profiles: app.bsky.actor.defs.ProfileViewDetailed[]}>
  >({queryKey: [eventGoingQueryKeyRoot]})
  for (const [_queryKey, queryData] of queryDatas) {
    for (const page of queryData?.pages ?? []) {
      for (const profile of page.profiles) {
        if (profile.did === did) yield profile
      }
    }
  }
}
