import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {BRAND} from '#/config/brand'
import {hasSupporterEntitlement} from './records'

const supporterQueryKeyRoot = 'supporter'

export const createSupporterQueryKey = (did: string) =>
  createQueryKey(supporterQueryKeyRoot, {
    did,
    listUris: BRAND.decorations.subscriberListUris,
  })

/** One membership lookup per DID, shared by every badge for that profile. */
export function useIsSupporter(did: string | undefined): boolean {
  const listUris = BRAND.decorations.subscriberListUris
  const enabled = BRAND.decorations.enabled && !!did && listUris.length > 0
  const {data} = useQuery({
    queryKey: createSupporterQueryKey(did ?? ''),
    enabled,
    staleTime: STALE.MINUTES.THIRTY,
    queryFn: () => hasSupporterEntitlement(did!, listUris),
  })
  return enabled && data === true
}
