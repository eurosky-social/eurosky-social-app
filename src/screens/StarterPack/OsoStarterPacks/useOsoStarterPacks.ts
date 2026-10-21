import {type AtUriString} from '@atproto/syntax'
import {useQueries} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {app} from '#/lexicons'
import {useOsoStarterPackUris} from './useOsoStarterPackUris'

const osoStarterPackQueryKeyRoot = 'oso-starter-pack'

/**
 * The configured account's starter packs as full `StarterPackView`s, shared by
 * the /starter-packs screen and onboarding.
 *
 * Each pack is hydrated with `getStarterPack` (its own query, so loading the
 * next page doesn't refetch earlier packs). Packs are returned in order, up to
 * the first one still loading, so the list grows without reordering. A pack
 * that fails to load (deleted, taken down) is left out.
 */
export function useOsoStarterPacks() {
  const appviewClient = useAppviewClient()
  const {uris, isLoading, ...rest} = useOsoStarterPackUris()

  const packs = useQueries({
    queries: uris.map(uri => ({
      queryKey: createQueryKey(osoStarterPackQueryKeyRoot, {uri}),
      queryFn: async () => {
        const res = await appviewClient.call(app.bsky.graph.getStarterPack, {
          starterPack: uri as AtUriString,
        })
        return res.starterPack
      },
      staleTime: STALE.MINUTES.FIVE,
    })),
    combine: results => {
      const firstPending = results.findIndex(r => r.isLoading)
      const settled =
        firstPending === -1 ? results : results.slice(0, firstPending)
      return {
        starterPacks: settled.flatMap(r => (r.data ? [r.data] : [])),
        isLoading: firstPending !== -1,
      }
    },
  })

  return {
    ...rest,
    starterPacks: packs.starterPacks,
    isLoading: isLoading || packs.isLoading,
  }
}
