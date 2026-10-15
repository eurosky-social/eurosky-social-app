import {type Client} from '@atproto/lex'
import {type QueryClient} from '@tanstack/react-query'

import {
  type MuVerification,
  muVerificationQueryOptions,
} from '#/state/queries/verification/useMuVerificationQuery'

/**
 * Whether an account may post tiles: it has been verified by one of mu's
 * trusted verifiers, or is one of them. Anyone may repost or quote a tile post.
 */
export function canPostTiles(
  verification: MuVerification | undefined,
): boolean {
  return (
    !!verification &&
    (verification.isVerifier || verification.verifications.length > 0)
  )
}

/** Resolves the account's verification (cached) and answers `canPostTiles`. */
export async function fetchCanPostTiles(
  queryClient: QueryClient,
  appviewClient: Client,
  did: string,
): Promise<boolean> {
  try {
    const verification = await queryClient.fetchQuery(
      muVerificationQueryOptions(queryClient, appviewClient, did),
    )
    return canPostTiles(verification)
  } catch {
    return false
  }
}

/** Thrown by the post pipeline when an unverified account tries to post a tile. */
export class TilesNotAllowedError extends Error {
  constructor() {
    super('Only verified accounts can post tiles')
  }
}
