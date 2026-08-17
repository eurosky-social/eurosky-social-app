import {
  type InfiniteData,
  keepPreviousData,
  type QueryKey,
  useInfiniteQuery,
} from '@tanstack/react-query'

import {BLUESKY_APPVIEW_SERVICE} from '#/lib/constants'
import {STALE} from '#/state/queries'
import {
  useAppviewClient,
  usePublicBlueskyAppviewClient,
  useSession,
} from '#/state/session'
import {app} from '#/lexicons'

export const RQKEY_ROOT = 'starter-pack-search'
export const RQKEY = (query: string, limit?: number) => [
  RQKEY_ROOT,
  query,
  limit,
]

export function useStarterPackSearch({
  query,
  enabled,
  maintainData,
  limit = 25,
}: {
  query: string
  enabled?: boolean
  maintainData?: boolean
  limit?: number
}) {
  const client = useAppviewClient()
  const publicBlueskyClient = usePublicBlueskyAppviewClient()
  const {hasSession} = useSession()
  return useInfiniteQuery<
    app.bsky.graph.searchStarterPacksV2.$OutputBody,
    Error,
    InfiniteData<app.bsky.graph.searchStarterPacksV2.$OutputBody>,
    QueryKey,
    string | undefined
  >({
    staleTime: STALE.MINUTES.FIVE,
    queryKey: RQKEY(query, limit),
    queryFn: async ({pageParam}) => {
      const params = {
        q: query,
        limit,
        cursor: pageParam,
      }
      /*
       * Eurosky does not yet implement the complete v2 search behavior. Signed
       * in, route through the PDS to Bluesky; logged out, use Bluesky's public
       * AppView directly.
       */
      return hasSession
        ? await client.call(app.bsky.graph.searchStarterPacksV2, params, {
            service: BLUESKY_APPVIEW_SERVICE,
          })
        : await publicBlueskyClient.call(
            app.bsky.graph.searchStarterPacksV2,
            params,
          )
    },
    enabled: enabled && !!query,
    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage.cursor,
    placeholderData: maintainData ? keepPreviousData : undefined,
    select,
  })
}

function select(
  data: InfiniteData<app.bsky.graph.searchStarterPacksV2.$OutputBody>,
) {
  // enforce uniqueness
  const uris = new Set()

  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      starterPacks: page.starterPacks.filter(starterPack => {
        if (uris.has(starterPack.uri)) {
          return false
        }
        uris.add(starterPack.uri)
        return true
      }),
    })),
  }
}
