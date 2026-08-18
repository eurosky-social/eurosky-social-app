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
  limit?: number
}

export const getSuggestedUsersForDiscoverQueryKeyRoot =
  'unspecced-suggested-users-for-explore'
export const createGetSuggestedUsersForDiscoverQueryKey = (props: {
  limit?: number
}) => [getSuggestedUsersForDiscoverQueryKeyRoot, props.limit]

export function useGetSuggestedUsersForDiscoverQuery(props: QueryProps = {}) {
  const {client, service} = useBlueskyAppviewRequestTarget()
  const {data: preferences} = usePreferencesQuery()

  return useQuery({
    staleTime: STALE.MINUTES.THREE,
    queryKey: createGetSuggestedUsersForDiscoverQueryKey({limit: props.limit}),
    queryFn: async () => {
      const contentLangs = getContentLanguages().join(',')
      const userInterests = aggregateUserInterests(preferences)

      const params = {limit: props.limit || 10}
      const headers = {
        ...createBskyTopicsHeader(userInterests),
        'Accept-Language': contentLangs,
      }
      const data = await client.call(
        app.bsky.unspecced.getSuggestedUsersForDiscover,
        params,
        {headers, service},
      )
      if (!data.recIdStr) {
        logger.debug('getSuggestedUsersForDiscover response missing recIdStr')
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
    queryClient.getQueriesData<app.bsky.unspecced.getSuggestedUsersForDiscover.$OutputBody>(
      {
        queryKey: [getSuggestedUsersForDiscoverQueryKeyRoot],
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
