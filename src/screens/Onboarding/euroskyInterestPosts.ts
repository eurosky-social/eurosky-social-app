import {type AtpAgent} from '@atproto/api'

import {interests} from '#/lib/interests'
import {BRAND} from '#/config/brand'

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
  agent: AtpAgent,
): Promise<Map<string, {uri: string; cid: string}>> {
  const refs = new Map<string, {uri: string; cid: string}>()
  const pickerDid = BRAND.fu.pickerDid
  if (!pickerDid) return refs

  try {
    let cursor: string | undefined
    do {
      const {data} = await agent.app.bsky.feed.getAuthorFeed({
        actor: pickerDid,
        filter: 'posts_no_replies',
        limit: 100,
        cursor,
      })
      for (const item of data.feed) {
        if (item.reason) continue // skip reposts
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
  agent: AtpAgent,
  selectedInterests: string[],
): Promise<{uri: string; cid: string}[]> {
  const refs = await fetchInterestPostRefs(agent)
  return selectedInterests
    .map(interest => refs.get(interest))
    .filter((ref): ref is {uri: string; cid: string} => ref !== undefined)
}
