import {useActorStarterPacksQuery} from '#/state/queries/actor-starter-packs'
import {OSO_STARTER_PACKS_ACTOR} from './config'
import {FALLBACK_STARTER_PACKS} from './fallbackStarterPacks'

/**
 * URIs of the starter packs to list: the configured account's packs, or the
 * fallback list when no account is configured.
 *
 * Only URIs are returned because `getActorStarterPacks` gives
 * `StarterPackViewBasic`, which lacks the `listItemsSample` the card's avatar
 * row needs. Each row loads its full pack with `useStarterPackQuery`.
 *
 * A configured account with no packs, or a failed request, shows the empty or
 * error state rather than the fallback, so a misconfiguration stays visible.
 */
export function useOsoStarterPackUris() {
  const query = useActorStarterPacksQuery({
    did: OSO_STARTER_PACKS_ACTOR,
    enabled: Boolean(OSO_STARTER_PACKS_ACTOR),
  })

  if (!OSO_STARTER_PACKS_ACTOR) {
    return {
      uris: FALLBACK_STARTER_PACKS,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: async () => {},
      fetchNextPage: () => {},
      hasNextPage: false,
      isFetchingNextPage: false,
    }
  }

  return {
    uris:
      query.data?.pages.flatMap(page => page.starterPacks.map(sp => sp.uri)) ??
      [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: () => query.refetch(),
    fetchNextPage: () => void query.fetchNextPage(),
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
