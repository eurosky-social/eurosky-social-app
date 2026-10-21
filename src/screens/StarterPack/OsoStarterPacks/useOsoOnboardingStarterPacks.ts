import {useEuroskyOnboardingSuggestedStarterPacks} from '#/screens/Onboarding/euroskySuggestedStarterPacks'
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
  const useFallback =
    !oso.isLoading && (!!oso.error || oso.starterPacks.length === 0)

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
    data: oso.isLoading ? undefined : {starterPacks: oso.starterPacks},
    isLoading: oso.isLoading,
    isError: false,
    isRefetching: oso.isRefetching,
    refetch: () => void oso.refetch(),
  }
}
