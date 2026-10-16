import {type Client} from '@atproto/lex'
import {type QueryClient} from '@tanstack/react-query'

import {VERIFICATION_DENYLIST_DIDS} from '#/lib/constants'
import {
  type MuVerification,
  muVerificationQueryOptions,
} from '#/state/queries/verification/useMuVerificationQuery'

/**
 * Whether a tile may run: its author (the account whose repo holds the
 * `ing.dasl.masl` record) has been verified by one of mu's trusted verifiers,
 * or is one of them. A tile is code, so the trust root is ours alone: Bluesky's
 * own verifications do not count here, and a denylisted account never does.
 *
 * Anyone may post, repost or quote a tile; the rule is about who made it.
 */
export function isTrustedTileAuthor(
  did: string,
  verification: MuVerification | undefined,
): boolean {
  if (VERIFICATION_DENYLIST_DIDS.has(did)) return false
  return (
    !!verification &&
    (verification.isVerifier || verification.verifications.length > 0)
  )
}

/** Resolves the author's verification (cached) and answers `isTrustedTileAuthor`. */
export async function fetchIsTrustedTileAuthor(
  queryClient: QueryClient,
  appviewClient: Client,
  did: string,
): Promise<boolean> {
  try {
    const verification = await queryClient.fetchQuery(
      muVerificationQueryOptions(queryClient, appviewClient, did),
    )
    return isTrustedTileAuthor(did, verification)
  } catch {
    return false
  }
}

/** Thrown by the post pipeline when the tile being attached has an unverified author. */
export class UntrustedTileAuthorError extends Error {
  constructor() {
    super('Only tiles published by verified accounts can be posted')
  }
}
