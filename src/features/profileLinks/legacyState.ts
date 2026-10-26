import {queryOptions, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {checkSafelink} from './safelink'

/** Share the compatibility-entry warning and migration's Safelink decision. */
export function legacyWebsiteCheckOptions(url: string) {
  return queryOptions({
    queryKey: createQueryKey('legacyWebsiteCheck', {url}),
    queryFn: () => checkSafelink(url),
    staleTime: STALE.MINUTES.ONE,
  })
}

/** Only check legacy destinations that would otherwise migrate successfully. */
export function useLegacyWebsiteCheck(url: string | undefined) {
  return useQuery({
    ...legacyWebsiteCheckOptions(url ?? ''),
    enabled: !!url,
  })
}
