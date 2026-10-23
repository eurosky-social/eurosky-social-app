import {sanitizeWebsiteUrl} from '#/lib/strings/url-helpers'
import {validateLinkInput} from './providers'
import {
  MAX_PROFILE_LINKS,
  type OwnProfileLinks,
  type ProfileLink,
  type ProfileLinkRef,
} from './types'

/** Compare destinations without changing their scheme, path, query or fragment. */
export function websiteKey(url: string): string {
  return sanitizeWebsiteUrl(url) || url.trim()
}

/**
 * Append the old website to the new UI, without giving it a fake record ref.
 * Compare against unfiltered destinations so moderation can't reveal a duplicate.
 * Owners can repair even malformed legacy values; visitors only get safe URLs.
 */
export function mergeLegacyWebsite(
  links: ProfileLink[],
  website: string | undefined,
  nativeUrls: string[],
  owner = false,
): ProfileLink[] {
  if (!website) return links
  const url = sanitizeWebsiteUrl(website)
  if (!url && !owner) return links
  if (nativeUrls.some(native => websiteKey(native) === websiteKey(website))) {
    return links
  }
  return [...links, {url: url || website, legacyWebsite: website}]
}

/** Refs that aren't editable must survive unrelated saves. */
export function hiddenLinkRefs(snapshot: OwnProfileLinks): ProfileLinkRef[] {
  const visible = new Set(snapshot.links.map(link => link.uri))
  return snapshot.refs.filter(ref => !visible.has(ref.uri))
}

/** Keep hidden refs in their original slots while applying the visible order. */
export function mergeSavedLinkRefs(
  snapshot: OwnProfileLinks,
  refs: ProfileLinkRef[],
): ProfileLinkRef[] {
  const hidden = new Map(hiddenLinkRefs(snapshot).map(ref => [ref.uri, ref]))
  const merged: ProfileLinkRef[] = []
  let index = 0
  for (const before of snapshot.refs) {
    const preserved = hidden.get(before.uri)
    if (preserved) merged.push(preserved)
    else if (index < refs.length) merged.push(refs[index++])
  }
  return [...merged, ...refs.slice(index)]
}

/**
 * Plan a lossless save. An untouched, incompatible or overflowing website stays
 * in the old field. An explicit edit/removal replaces/clears it instead.
 */
export function planProfileLinksSave(
  snapshot: OwnProfileLinks,
  links: ProfileLink[],
  canMigrate = true,
) {
  const preservedRefs = hiddenLinkRefs(snapshot)
  const legacy = links.find(link => link.legacyWebsite !== undefined)
  const nativeLinks = links.filter(link => link !== legacy)
  let website: string | undefined
  if (legacy) {
    const validation = validateLinkInput(legacy.url)
    if (
      !canMigrate ||
      !validation.url ||
      validation.isBlocked ||
      validation.isShortener ||
      validation.isInsecure ||
      nativeLinks.length + preservedRefs.length >= MAX_PROFILE_LINKS
    ) {
      website = snapshot.website
    } else {
      /* Keep the editor's order, including a reordered legacy entry. */
      nativeLinks.splice(links.indexOf(legacy), 0, {
        ...legacy,
        url: validation.url,
        legacyWebsite: undefined,
      })
    }
  }
  if (nativeLinks.length + preservedRefs.length > MAX_PROFILE_LINKS) {
    throw new Error('Too many profile links')
  }
  return {links: nativeLinks, preservedRefs, website}
}

/** A stale editor must not overwrite another client's link changes. */
export class ProfileLinksChangedError extends Error {
  constructor() {
    super('Profile links changed. Reopen your profile and try again.')
    this.name = 'ProfileLinksChangedError'
  }
}

/** Refuse to overwrite links or a website edited in another client. */
export function assertProfileLinksUnchanged(
  snapshot: OwnProfileLinks,
  profile: {links?: ProfileLinkRef[]; website?: string},
) {
  if (
    (profile.website || undefined) !== (snapshot.website || undefined) ||
    (profile.links ?? []).length !== snapshot.refs.length ||
    (profile.links ?? []).some(
      (ref, i) =>
        ref.uri !== snapshot.refs[i].uri || ref.cid !== snapshot.refs[i].cid,
    )
  ) {
    throw new ProfileLinksChangedError()
  }
}
