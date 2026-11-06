import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {PLC_DIRECTORY_URL} from '#/state/session/identity-resolver'

const plcCreatedAtQueryKeyRoot = 'plc-created-at'

/**
 * When the current account was created. AppViews don't all agree on this:
 * Bluesky's reports the account's creation date, but some only copy the
 * profile record's optional `createdAt`, which older profiles don't have. For
 * did:plc accounts we fall back to the first operation in the PLC audit log,
 * which is the moment the DID was created. Anything else stays undefined.
 */
export function useAccountCreatedAt(): string | undefined {
  const {currentAccount} = useSession()
  const profile = useCurrentAccountProfile()
  const did = currentAccount?.did
  const needsFallback =
    !!profile && !profile.createdAt && !!did?.startsWith('did:plc:')

  const {data: plcCreatedAt} = useQuery({
    enabled: needsFallback,
    // A DID's creation time never changes.
    staleTime: STALE.INFINITY,
    queryKey: createQueryKey(plcCreatedAtQueryKeyRoot, {did}),
    queryFn: async () => {
      const res = await fetch(
        `${PLC_DIRECTORY_URL}/${encodeURIComponent(did!)}/log/audit`,
      )
      if (!res.ok) {
        throw new Error(`PLC audit log returned ${res.status}`)
      }
      const log: unknown = await res.json()
      const createdAt = Array.isArray(log)
        ? (log[0] as {createdAt?: unknown} | undefined)?.createdAt
        : undefined
      return typeof createdAt === 'string' ? createdAt : null
    },
  })

  return profile?.createdAt ?? plcCreatedAt ?? undefined
}
