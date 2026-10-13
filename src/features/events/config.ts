/**
 * Base URL of the events AppView (a contrail instance, see
 * ../40worldwide-contrail). It is public and unauthenticated with open CORS, so
 * the app calls it directly rather than proxying through the user's PDS.
 */
export const EVENTS_APPVIEW_URL =
  process.env.EXPO_PUBLIC_EVENTS_APPVIEW_URL ||
  'https://contrail-production.up.railway.app'

/**
 * Base URL of the 40verse web app, which renders events at
 * `/p/<actor>/e/<rkey>`. The "Open on 40verse" button is hidden when unset.
 */
export const FORTYVERSE_URL =
  process.env.EXPO_PUBLIC_EVENTS_FORTYVERSE_URL || ''

/** XRPC namespace of the events AppView's endpoints. */
export const EVENTS_NAMESPACE = 'social.40verse'

/** Lexicon NSIDs of the indexed records. */
export const EVENT_NSID = 'community.lexicon.calendar.event'
export const RSVP_NSID = 'community.lexicon.calendar.rsvp'

/** Page size for event lists. */
export const EVENTS_PAGE_SIZE = 30

/** Most posts about an event shown under it in a feed. */
export const EVENT_POSTS_SHOWN = 3
