import {CDN_SERVICE} from '#/lib/constants'
import {FORTYVERSE_URL} from './config'
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
  const images = (event.value.media ?? []).filter(isImage)
  const media =
    images.find(m => m.role === 'banner') ??
    images.find(m => m.role === 'thumbnail') ??
    images[0]
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

/**
 * The event's page on the 40verse web app, or undefined when no 40verse URL is
 * configured. The actor slot accepts a handle or a DID; handles read nicer.
 */
export function getFortyVerseEventUrl(
  event: EventRecord,
  profile?: EventProfile,
): string | undefined {
  if (!FORTYVERSE_URL) return undefined
  const actor = profile?.handle ?? event.did
  // Handles, DIDs and rkeys are all path-safe, so no encoding is needed.
  return new URL(`/p/${actor}/e/${event.rkey}`, FORTYVERSE_URL).href
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
