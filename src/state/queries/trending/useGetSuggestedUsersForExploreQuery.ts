import {type QueryClient, useQuery} from '@tanstack/react-query'

import {
  aggregateUserInterests,
  createBskyTopicsHeader,
} from '#/lib/api/feed/utils'
import {logger} from '#/logger'
import {getContentLanguages} from '#/state/preferences/languages'
import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {useBlueskyAppviewRequestTarget} from '#/state/session'
import {app} from '#/lexicons'

export type QueryProps = {
  category?: string | null
  limit?: number
}

export const getSuggestedUsersForExploreQueryKeyRoot =
  'unspecced-suggested-users-for-explore'
export const createGetSuggestedUsersForExploreQueryKey = (
  props: QueryProps,
) => [getSuggestedUsersForExploreQueryKeyRoot, props.category, props.limit]

export function useGetSuggestedUsersForExploreQuery(props: QueryProps = {}) {
  const {client, service} = useBlueskyAppviewRequestTarget()
  const {data: preferences} = usePreferencesQuery()

  return useQuery({
    staleTime: STALE.MINUTES.THREE,
    queryKey: createGetSuggestedUsersForExploreQueryKey(props),
    queryFn: async () => {
      const contentLangs = getContentLanguages().join(',')
      const userInterests = aggregateUserInterests(preferences)

      const params = {
        category: props.category ?? undefined,
        limit: props.limit || 10,
      }
      const headers = {
        ...createBskyTopicsHeader(userInterests),
        'Accept-Language': contentLangs,
      }
      const data = await client.call(
        app.bsky.unspecced.getSuggestedUsersForExplore,
        params,
        {headers, service},
      )

      if (!data.recIdStr) {
        logger.debug('getSuggestedUsersForExplore response missing recIdStr')
      }
      return {...data, recId: data.recIdStr}
    },
  })
}

export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<app.bsky.actor.defs.ProfileView, void> {
  const responses =
    queryClient.getQueriesData<app.bsky.unspecced.getSuggestedUsersForExplore.$OutputBody>(
      {
        queryKey: [getSuggestedUsersForExploreQueryKeyRoot],
      },
    )
  for (const [_key, response] of responses) {
    if (!response) {
      continue
    }

    for (const actor of response.actors) {
      if (actor.did === did) {
        yield actor
      }
    }
  }
}
