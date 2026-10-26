import {type Client} from '@atproto/lex'
import {type AtIdentifierString} from '@atproto/syntax'

import {interests} from '#/lib/interests'
import {BRAND} from '#/config/brand'
import {app, type com} from '#/lexicons'
import * as bsky from '#/types/bsky'

/*
 * The onboarding interest posts live on the "picker" account configured at
 * BRAND.fu.pickerDid (brand.json, overridable with EXPO_PUBLIC_PICKER_DID),
 * created by the foryou repo's `npm run createInterestPosts` script. Liking them
 * during onboarding seeds the fu feed's personalization.
 *
 * app.bsky.feed.post records use TID record keys, so the posts' at-uris are not
 * derivable from the interest id. Instead each post carries a #<interest> tag,
 * and we discover the interest -> post mapping at runtime by listing the picker
 * account's posts and reading that tag. Only the picker DID is configured;
 * nothing else is hard-coded. An empty/unreachable picker account yields an
 * empty map - a safe no-op matching the current (popularity) behavior.
 */

/** The interest id whose #tag appears in a post's text, if any. */
function interestOf(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined
  return interests.find(id => text.includes(`#${id}`))
}

/**
 * Resolves the picker account's interest posts to strong refs (uri + cid) keyed
 * by interest id. Best-effort: returns whatever it resolved (possibly empty) and
 * never throws, so onboarding is never blocked by this.
 */
export async function fetchInterestPostRefs(
  client: Client,
): Promise<Map<string, com.atproto.repo.strongRef.Main>> {
  const refs = new Map<string, com.atproto.repo.strongRef.Main>()
  const pickerDid = BRAND.fu.pickerDid
  if (!pickerDid) return refs

  try {
    let cursor: string | undefined
    do {
      const data = await client.call(app.bsky.feed.getAuthorFeed, {
        actor: pickerDid as AtIdentifierString,
        filter: 'posts_no_replies',
        limit: 100,
        cursor,
      })
      for (const item of data.feed) {
        if (item.reason) continue // skip reposts
        if (!bsky.isType(app.bsky.feed.post, item.post.record)) continue
        const interest = interestOf(item.post.record.text)
        if (interest && !refs.has(interest)) {
          refs.set(interest, {uri: item.post.uri, cid: item.post.cid})
        }
      }
      cursor = data.cursor
    } while (cursor && refs.size < interests.length)
  } catch {
    // best-effort; onboarding proceeds with whatever (if anything) resolved
  }

  return refs
}

/**
 * Strong refs for the interest posts matching the given selected interests,
 * ready to be liked. Empty until the picker account is configured / reachable.
 */
export async function interestPostRefsFor(
  client: Client,
  selectedInterests: string[],
): Promise<com.atproto.repo.strongRef.Main[]> {
  const refs = await fetchInterestPostRefs(client)
  return selectedInterests
    .map(interest => refs.get(interest))
    .filter((ref): ref is com.atproto.repo.strongRef.Main => ref !== undefined)
}
