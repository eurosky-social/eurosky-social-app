import {BRAND} from '#/config/brand'

/**
 * atmo.rsvp event links look like:
 *   https://atmo.rsvp/p/{handle}/e/{rkey}
 * where {handle} is the event owner (handle or DID) and {rkey} is the rkey of
 * their `community.lexicon.calendar.event` record.
 */
const ATMO_RSVP_EVENT_RE = /^https?:\/\/atmo\.rsvp\/p\/([^/]+)\/e\/([^/?#]+)/i

/**
 * Our own event pages, which new posts about an event link to, look like:
 *   https://{brand host}/events/{handle}/{rkey}
 * They render the same record, so they get the same card.
 */
const BRAND_EVENT_RE = new RegExp(
  `^https?://(?:${BRAND.web.hosts
    .map(host => host.replace(/\./g, '\\.'))
    .join('|')})/events/([^/]+)/([^/?#]+)/?(?:[?#]|$)`,
  'i',
)

export type AtmoRsvpEventRef = {
  /** Handle or DID of the event owner, taken verbatim from the URL. */
  actor: string
  rkey: string
  /** Whether the link is to our own site rather than atmo.rsvp. */
  isBrandLink: boolean
}

export function parseAtmoRsvpEvent(url: string): AtmoRsvpEventRef | null {
  const atmoMatch = ATMO_RSVP_EVENT_RE.exec(url)
  const match = atmoMatch ?? BRAND_EVENT_RE.exec(url)
  if (!match) return null
  const [, actor, rkey] = match
  if (!actor || !rkey) return null
  return {actor: decodeURIComponent(actor), rkey, isBrandLink: !atmoMatch}
}

export function isAtmoRsvpEventUrl(url: string): boolean {
  return parseAtmoRsvpEvent(url) !== null
}
