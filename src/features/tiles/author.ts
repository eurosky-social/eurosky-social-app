import {type Client} from '@atproto/lex'
import {type QueryClient} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {useProfileQuery} from '#/state/queries/profile'
import {useMuVerificationQuery} from '#/state/queries/verification/useMuVerificationQuery'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {type app} from '#/lexicons'
import {parseTileUri} from './detect'
import {fetchIsTrustedTileAuthor, isTrustedTileAuthor} from './permissions'
import {type TileRef} from './record'

/**
 * The account a tile belongs to: the repo in its at-URI. A DID when the
 * pointer was written by mu (the record is read back from the author's PDS by
 * DID), but a handle is possible in a post from another client.
 */
export function tileAuthorActor(tile: TileRef | string): string | undefined {
  return parseTileUri(typeof tile === 'string' ? tile : tile.uri)?.repo
}

/**
 * Whether a tile may run, resolved outside a render: the gate the embeds
 * apply before loading anything, and the post pipeline before attaching. A
 * handle is resolved to its DID first; anything that fails to resolve is not
 * trusted.
 */
export async function fetchIsTrustedTile(
  queryClient: QueryClient,
  appviewClient: Client,
  tile: TileRef | string,
): Promise<boolean> {
  const actor = tileAuthorActor(tile)
  if (!actor) return false
  try {
    const did = actor.startsWith('did:')
      ? actor
      : (await resolveDidAndPds(actor)).did
    return await fetchIsTrustedTileAuthor(queryClient, appviewClient, did)
  } catch {
    return false
  }
}

export type TileAuthor = {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  /**
   * Verified by one of our trusted verifiers, or one of them. Undefined while
   * that is still being looked up, so the card never claims more than it
   * knows either way; false once the lookup has failed.
   */
  trusted: boolean | undefined
}

/**
 * The tile's author for the card footer, with the verdict on whether the tile
 * may run. Undefined until the profile has loaded. The embeds do not act on
 * `trusted`: they ask `fetchIsTrustedTile` when the tile is opened.
 */
export function useTileAuthor(tile: TileRef): TileAuthor | undefined {
  const actor = tileAuthorActor(tile)
  const {data: profile} = useProfileQuery({
    did: actor,
    staleTime: STALE.MINUTES.FIVE,
  })
  const verification = useMuVerificationQuery({did: profile?.did})
  if (!profile) return undefined
  let trusted: boolean | undefined
  if (verification.data) {
    trusted = isTrustedTileAuthor(profile.did, verification.data)
  } else if (verification.isError) {
    trusted = false
  }
  return {profile, trusted}
}
