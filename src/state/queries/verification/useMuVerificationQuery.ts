import {type Client} from '@atproto/lex'
import {type DatetimeString} from '@atproto/syntax'
import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {getVerificationBacklinks} from '#/lib/verification/constellation'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {ensureTrustedVerifierDids} from '#/state/queries/verification/useTrustedVerifiersQuery'
import {useAppviewClient} from '#/state/session'
import {type app} from '#/lexicons'

export type MuVerification = {
  /**
   * Verifications of this subject issued by one of our trusted verifiers. These
   * carry `isValid: true` and an empty `createdAt`: the backlink index gives us
   * the record's identity but not its body, so strict validity and the creation
   * date are resolved lazily where the record is actually fetched (the dialog).
   */
  verifications: app.bsky.actor.defs.VerificationView[]
  /** Whether this subject is itself a trusted verifier. */
  isVerifier: boolean
}

const muVerificationQueryKeyRoot = 'mu-verification'
export const createMuVerificationQueryKey = (did: string) =>
  createQueryKey(muVerificationQueryKeyRoot, {did})

/**
 * The query behind `useMuVerificationQuery`, for code that needs the answer
 * outside a render (the composer, before attaching a tile).
 */
export function muVerificationQueryOptions(
  qc: QueryClient,
  appviewClient: Client,
  did: string | undefined,
) {
  return queryOptions<MuVerification>({
    queryKey: createMuVerificationQueryKey(did ?? ''),
    staleTime: STALE.MINUTES.FIVE,
    queryFn: async () => {
      const trusted = await ensureTrustedVerifierDids(qc, appviewClient)
      const backlinks = did ? await getVerificationBacklinks(did) : []
      const verifications = backlinks
        .filter(b => trusted.has(b.issuer))
        .map(b => ({
          issuer: b.issuer,
          uri: b.uri,
          isValid: true,
          createdAt: '' as DatetimeString,
        }))
      return {
        verifications,
        isVerifier: !!did && trusted.has(did),
      }
    },
  })
}

export function useMuVerificationQuery({did}: {did?: string}) {
  const qc = useQueryClient()
  const appviewClient = useAppviewClient()
  return useQuery({
    ...muVerificationQueryOptions(qc, appviewClient, did),
    enabled: !!did,
  })
}
