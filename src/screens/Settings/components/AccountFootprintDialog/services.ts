/**
 * Known NSID namespaces and the service a person would recognise them by.
 * Matched by longest prefix, so a more specific entry wins over a broader one.
 */
const KNOWN_SERVICES: {prefix: string; name: string}[] = [
  {prefix: 'app.bsky', name: 'Bluesky'},
  {prefix: 'chat.bsky', name: 'Bluesky'},
  {prefix: 'social.mu', name: 'Mu'},
  {prefix: 'sh.tangled', name: 'Tangled'},
  {prefix: 'fyi.unravel.frontpage', name: 'Frontpage'},
  {prefix: 'com.whtwnd', name: 'WhiteWind'},
  {prefix: 'pub.leaflet', name: 'Leaflet'},
  {prefix: 'events.smokesignal', name: 'Smoke Signal'},
  {prefix: 'rsvp.atmo', name: 'Atmo'},
  {prefix: 'community.lexicon.calendar', name: 'Calendar events'},
  {prefix: 'fm.teal', name: 'teal.fm'},
  {prefix: 'app.rocksky', name: 'Rocksky'},
  {prefix: 'blue.flashes', name: 'Flashes'},
  {prefix: 'so.sprk', name: 'Spark'},
  {prefix: 'com.shinolabs.pinksea', name: 'PinkSea'},
  {prefix: 'blue.linkat', name: 'Linkat'},
  {prefix: 'xyz.statusphere', name: 'Statusphere'},
  {prefix: 'app.popsky', name: 'Popsky'},
  {prefix: 'com.atproto', name: 'AT Protocol'},
]

function matchesPrefix(nsid: string, prefix: string) {
  return nsid === prefix || nsid.startsWith(prefix + '.')
}

/**
 * The service a collection belongs to. Unknown namespaces fall back to the
 * domain the NSID was derived from, e.g. `com.example.thing` -> `example.com`.
 */
export function serviceForCollection(nsid: string): {
  key: string
  name: string
} {
  let best: {prefix: string; name: string} | undefined
  for (const service of KNOWN_SERVICES) {
    if (
      matchesPrefix(nsid, service.prefix) &&
      (!best || service.prefix.length > best.prefix.length)
    ) {
      best = service
    }
  }
  if (best) {
    return {key: best.name, name: best.name}
  }

  // The last segment is the record name; the rest is the reversed domain.
  const authority = nsid.split('.').slice(0, -1).reverse().join('.')
  const domain = authority || nsid
  return {key: domain, name: domain}
}

export type CollectionCount = {nsid: string; count: number}

export type ServiceFootprint = {
  key: string
  name: string
  /** Largest first. */
  collections: CollectionCount[]
  total: number
}

/**
 * Groups per-collection counts into services, largest first.
 */
export function groupByService(
  collections: CollectionCount[],
): ServiceFootprint[] {
  const byKey = new Map<string, ServiceFootprint>()
  for (const collection of collections) {
    const {key, name} = serviceForCollection(collection.nsid)
    let service = byKey.get(key)
    if (!service) {
      service = {key, name, collections: [], total: 0}
      byKey.set(key, service)
    }
    service.collections.push(collection)
    service.total += collection.count
  }
  const services = [...byKey.values()]
  for (const service of services) {
    service.collections.sort(
      (x, y) => y.count - x.count || x.nsid.localeCompare(y.nsid),
    )
  }
  return services.sort(
    (x, y) => y.total - x.total || x.name.localeCompare(y.name),
  )
}

/**
 * Fallback label for a record type with no curated name: the record name split
 * into words, e.g. `app.example.newsFeedPrefs` -> `News feed prefs`.
 */
export function humanizeRecordName(nsid: string): string {
  const name = nsid.slice(nsid.lastIndexOf('.') + 1)
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
