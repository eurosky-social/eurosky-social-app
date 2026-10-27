import {useEffect} from 'react'

import {useEuroskyOnboardingSuggestedStarterPacks} from '#/screens/Onboarding/euroskySuggestedStarterPacks'
import {IS_PARTNER_PREVIEW} from '#/env'
import {useOsoStarterPacks} from './useOsoStarterPacks'

/**
 * Oso onboarding starter packs: the configured account's packs (first page),
 * same as the /starter-packs screen. Mirrors the signature and return shape of
 * `useEuroskyOnboardingSuggestedStarterPacks`, which is swapped in with a
 * one-line import in StepSuggestedStarterpacks.
 *
 * Falls back to Eurosky's curated packs when the account has no packs or the
 * request fails, so new users never get an empty step.
 */
export function useOsoOnboardingSuggestedStarterPacks(props: {
  enabled?: boolean
  overrideInterests?: string[]
}) {
  const oso = useOsoStarterPacks()
  /*
   * Oso lists every pack, like the /starter-packs screen, and shows the step's
   * error state rather than someone else's packs when they fail to load.
   */
  const useFallback =
    !IS_PARTNER_PREVIEW &&
    !oso.isLoading &&
    (!!oso.error || oso.starterPacks.length === 0)
  const {hasNextPage, isFetchingNextPage, fetchNextPage, error} = oso
  useEffect(() => {
    if (IS_PARTNER_PREVIEW && hasNextPage && !isFetchingNextPage && !error) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, error])

  const eurosky = useEuroskyOnboardingSuggestedStarterPacks({
    ...props,
    enabled: props.enabled !== false && useFallback,
  })

  if (useFallback) {
    return {
      ...eurosky,
      // Covers the render before the just-enabled fallback starts fetching.
      isLoading: eurosky.isLoading || (!eurosky.data && !eurosky.isError),
    }
  }

  return {
    // Oso's own packs are not recommendations, so they carry no recId.
    data: oso.isLoading
      ? undefined
      : {starterPacks: oso.starterPacks, recId: undefined},
    isLoading: oso.isLoading,
    isError: IS_PARTNER_PREVIEW && !!oso.error,
    isRefetching: oso.isRefetching,
    refetch: () => void oso.refetch(),
  }
}
