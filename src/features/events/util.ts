import {CDN_SERVICE} from '#/lib/constants'
import {
  type EventLocation,
  type EventMedia,
  type EventProfile,
  type EventRecord,
  type RsvpStatus,
} from './types'

/**
 * Picks the event's banner, falling back to its thumbnail or first image.
 * Returns undefined when the event has no image.
 */
export function getEventImage(event: EventRecord):
  | {
      url: string
      alt?: string
    }
  | undefined {
  const media = event.value.media?.[getEventImageIndex(event.value.media)]
  const cid = media?.content?.ref?.$link
  if (!cid) return undefined

  /*
   * Blobs live on the organiser's PDS. The Bluesky image CDN fetches them from
   * there and serves resized JPEGs, so we don't need to resolve the PDS.
   */
  return {
    url: `${CDN_SERVICE}/img/feed_thumbnail/plain/${event.did}/${cid}@jpeg`,
    alt: media.alt,
  }
}

/**
 * Index of the event's display image in its media: the banner, falling back
 * to the thumbnail or first image. Returns -1 when there is no image.
 */
export function getEventImageIndex(media: EventMedia[] = []): number {
  const roles = ['banner', 'thumbnail', undefined]
  for (const role of roles) {
    const index = media.findIndex(m => isImage(m) && (!role || m.role === role))
    if (index !== -1) return index
  }
  return -1
}

function isImage(media: EventMedia) {
  return media.content?.mimeType?.startsWith('image/') ?? false
}

/** The profile's avatar via the Bluesky image CDN, if it has one. */
export function getProfileAvatar(profile: EventProfile): string | undefined {
  const cid = profile.value?.avatar?.ref?.$link
  if (!cid) return undefined
  return `${CDN_SERVICE}/img/avatar_thumbnail/plain/${profile.did}/${cid}@jpeg`
}

/**
 * A short label for the event's first location that has one, e.g. a venue
 * name or "Amsterdam, NL". Returns undefined for locations without a readable
 * label, such as bare coordinates.
 */
export function getEventLocationLabel(event: EventRecord): string | undefined {
  for (const location of event.value.locations ?? []) {
    const label = getLocationLabel(location)
    if (label) return label
  }
  return undefined
}

function getLocationLabel(location: EventLocation): string | undefined {
  if (location.name) return location.name
  if (location.$type === 'community.lexicon.location.address') {
    const parts = [location.locality, location.country].filter(Boolean)
    if (parts.length) return parts.join(', ')
  }
  return undefined
}

/** Hosts that render an event at `/p/<actor>/e/<rkey>`. */
const ATMO_HOSTS = ['https://atmo.rsvp', 'https://events.atmosphere.tickets']

/**
 * The public web pages of other apps that render the event, as people link to
 * them in posts. Mirrors `eventShareUrls` in 40verse-atproto.
 *
 * Each host mints the link with the organiser's handle or DID, and post search
 * matches the exact URL, so both forms of every host are listed.
 */
export function getEventShareUrls(
  event: EventRecord,
  profile?: EventProfile,
): string[] {
  const actors = profile?.handle ? [event.did, profile.handle] : [event.did]
  return actors.flatMap(actor => [
    `https://smokesignal.events/${actor}/${event.rkey}`,
    ...ATMO_HOSTS.map(host => `${host}/p/${actor}/e/${event.rkey}`),
  ])
}

const RSVP_COUNT_FIELDS = {
  'community.lexicon.calendar.rsvp#going': 'rsvpsGoingCount',
  'community.lexicon.calendar.rsvp#interested': 'rsvpsInterestedCount',
  'community.lexicon.calendar.rsvp#notgoing': 'rsvpsNotgoingCount',
} as const satisfies Record<RsvpStatus, keyof EventRecord>

/**
 * Returns a copy of the event with its RSVP counts adjusted for the viewer
 * changing their RSVP from `prev` to `next` (null meaning no RSVP).
 */
export function applyRsvpChange(
  event: EventRecord,
  prev: RsvpStatus | null,
  next: RsvpStatus | null,
): EventRecord {
  const updated = {...event}
  const adjust = (
    field: 'rsvpsCount' | (typeof RSVP_COUNT_FIELDS)[RsvpStatus],
    delta: number,
  ) => {
    updated[field] = Math.max(0, (updated[field] ?? 0) + delta)
  }
  adjust('rsvpsCount', (next ? 1 : 0) - (prev ? 1 : 0))
  if (prev) adjust(RSVP_COUNT_FIELDS[prev], -1)
  if (next) adjust(RSVP_COUNT_FIELDS[next], 1)
  return updated
}
