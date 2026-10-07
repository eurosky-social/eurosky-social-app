/**
 * Base URL of the events AppView (a contrail instance, see
 * ../40worldwide-contrail). It is public and unauthenticated with open CORS, so
 * the app calls it directly rather than proxying through the user's PDS.
 */
export const EVENTS_APPVIEW_URL =
  process.env.EXPO_PUBLIC_EVENTS_APPVIEW_URL ||
  'https://contrail-production.up.railway.app'

/** XRPC namespace of the events AppView's endpoints. */
export const EVENTS_NAMESPACE = 'social.40verse'

/** Lexicon NSIDs of the indexed records. */
export const EVENT_NSID = 'community.lexicon.calendar.event'
export const RSVP_NSID = 'community.lexicon.calendar.rsvp'

/** Page size for event lists. */
export const EVENTS_PAGE_SIZE = 30
