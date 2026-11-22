import {useQuery} from '@tanstack/react-query'

import {
  aggregateUserInterests,
  createBskyTopicsHeader,
} from '#/lib/api/feed/utils'
import {getContentLanguages} from '#/state/preferences/languages'
import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {useBlueskyAppviewRequestTarget} from '#/state/session'
import {app} from '#/lexicons'

export const createSuggestedStarterPacksQueryKey = (interests?: string[]) => [
  'suggested-starter-packs',
  interests?.join(','),
]

export function useSuggestedStarterPacksQuery({
  enabled,
  overrideInterests,
}: {
  enabled?: boolean
  overrideInterests?: string[]
}) {
  // Starter-pack suggestions come from Bluesky's topics service, which other
  // AppViews don't have, so this always asks Bluesky's AppView.
  const {client, service} = useBlueskyAppviewRequestTarget()
  const {data: preferences} = usePreferencesQuery()
  const contentLangs = getContentLanguages().join(',')

  return useQuery({
    enabled: !!preferences && enabled !== false,
    staleTime: STALE.MINUTES.THREE,
    queryKey: createSuggestedStarterPacksQueryKey(overrideInterests),
    queryFn: async () => {
      const data = await client.call(
        app.bsky.unspecced.getSuggestedStarterPacks,
        {},
        {
          headers: {
            ...createBskyTopicsHeader(
              overrideInterests
                ? overrideInterests.join(',')
                : aggregateUserInterests(preferences),
            ),
            'Accept-Language': contentLangs,
          },
          service,
        },
      )

      return {...data, recId: data.recIdStr}
    },
  })
}
