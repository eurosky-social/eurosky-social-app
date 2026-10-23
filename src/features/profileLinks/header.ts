import {websiteKey} from './legacy'
import {type OwnProfileLinks, type ProfileLink} from './types'

/** Retain a local save's display order through refetches of the same repo state. */
export function keepSavedHeaderOrder(
  previous: OwnProfileLinks | undefined,
  next: Pick<OwnProfileLinks, 'refs' | 'website'>,
): boolean {
  return (
    !!previous?.locallySaved &&
    previous.website === next.website &&
    previous.refs.length === next.refs.length &&
    previous.refs.every(
      (ref, i) => ref.uri === next.refs[i].uri && ref.cid === next.refs[i].cid,
    )
  )
}

/** Keep the same CDN image while the editor's blob-backed records load. */
function withDisplayIcon(
  link: ProfileLink,
  displayed: ProfileLink | undefined,
): ProfileLink {
  if (
    !link.iconUrl &&
    link.icon &&
    link.cid === displayed?.cid &&
    displayed?.iconUrl
  ) {
    return {...link, iconUrl: displayed.iconUrl}
  }
  return link
}

/**
 * Loading edit records must not reorder the visible row. Match destinations,
 * including legacy/native duplicates, in their existing display slots. An
 * explicit local save is allowed to replace the order immediately.
 */
export function profileHeaderLinks(
  displayed: ProfileLink[],
  snapshot: OwnProfileLinks | undefined,
): ProfileLink[] {
  if (!snapshot) return displayed
  if (snapshot.locallySaved) {
    return snapshot.links.map(link =>
      withDisplayIcon(
        link,
        displayed.find(
          before => websiteKey(before.url) === websiteKey(link.url),
        ),
      ),
    )
  }
  const remaining = new Map(
    snapshot.links.map(link => [websiteKey(link.url), link]),
  )
  const links: ProfileLink[] = []
  for (const before of displayed) {
    const key = websiteKey(before.url)
    const loaded = remaining.get(key)
    if (!loaded) continue
    links.push(withDisplayIcon(loaded, before))
    remaining.delete(key)
  }
  return [...links, ...remaining.values()]
}

/** Match a displayed pill to the authoritative editing order, not its UI index. */
export function profileHeaderLinkIndex(
  link: ProfileLink,
  snapshot: OwnProfileLinks | undefined,
) {
  return (
    snapshot?.links.findIndex(
      candidate =>
        (link.uri && candidate.uri === link.uri) ||
        websiteKey(candidate.url) === websiteKey(link.url),
    ) ?? -1
  )
}
