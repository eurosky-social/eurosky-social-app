/*
 * Response types for the events AppView. The `social.40verse.*` lexicons are
 * not published, so these are hand-written from its API.md.
 */

type EventToken<T extends string> = `community.lexicon.calendar.event#${T}`
type RsvpToken<T extends string> = `community.lexicon.calendar.rsvp#${T}`

export type EventMode = EventToken<'inperson' | 'virtual' | 'hybrid'>
export type EventStatus = EventToken<
  'scheduled' | 'cancelled' | 'postponed' | 'rescheduled'
>
export type RsvpStatus = RsvpToken<'going' | 'interested' | 'notgoing'>

export type Blob = {
  $type: 'blob'
  ref: {$link: string}
  mimeType: string
  size: number
}

/**
 * Event locations are a lexicon union; read `$type` to tell them apart. Fields
 * are optional because records come verbatim from the network.
 */
export type EventLocation = {
  $type?: string
  name?: string
  street?: string
  locality?: string
  region?: string
  postalCode?: string
  country?: string
  latitude?: string
  longitude?: string
  uri?: string
}

export type EventMedia = {
  /** e.g. `thumbnail` or `banner`. */
  role?: string
  alt?: string
  content?: Blob
  aspect_ratio?: {width: number; height: number}
}

/** The raw `community.lexicon.calendar.event` record. */
export type EventRecordValue = {
  $type: 'community.lexicon.calendar.event'
  name: string
  description?: string
  mode?: EventMode
  status?: EventStatus
  /**
   * Usually ISO-8601, but malformed records can carry `{}` here, so guard
   * before parsing.
   */
  startsAt?: string | {}
  endsAt?: string | {}
  createdAt?: string | {}
  locations?: EventLocation[]
  uris?: {uri: string; name?: string}[]
  media?: EventMedia[]
}

/** The raw `community.lexicon.calendar.rsvp` record. */
export type RsvpRecordValue = {
  $type: 'community.lexicon.calendar.rsvp'
  status: RsvpStatus
  subject: {uri: string; cid?: string}
}

/** Fields common to every indexed record. */
type IndexedRecord<V> = {
  uri: string
  cid: string
  /** DID of the repo the record lives in. */
  did: string
  collection: string
  rkey: string
  /** Firehose commit time, in microseconds since the epoch. */
  time_us: number
  value: V
}

export type RsvpRecord = IndexedRecord<RsvpRecordValue>

export type EventRecord = IndexedRecord<EventRecordValue> & {
  /** RSVP counts are omitted when zero. */
  rsvpsCount?: number
  rsvpsGoingCount?: number
  rsvpsInterestedCount?: number
  rsvpsNotgoingCount?: number
  /** Present only with `hydrateRsvps=N`. */
  rsvps?: Partial<Record<RsvpStatus, RsvpRecord[]>>
}

/** A profile entry, present when `profiles=true` is passed. */
export type EventProfile = {
  did: string
  handle?: string
  value?: {
    displayName?: string
    description?: string
    avatar?: Blob
  }
}

/**
 * An RSVP by someone the viewer follows, from `event.followingRsvps`. Collapsed
 * to the strongest status per person and event.
 */
export type FollowingRsvp = {
  eventUri: string
  did: string
  handle?: string
  avatarCid?: string
  /** A bare word here, unlike the full token on RSVP records. */
  status: 'going' | 'interested' | 'notgoing'
}

export type ListResponse<T> = {
  records: T[]
  /** Present only when another page exists. */
  cursor?: string
  profiles?: EventProfile[]
}

export type GetRecordResponse<T> = T & {profiles?: EventProfile[]}

/** Filters shared by every event list endpoint. */
export type EventListParams = {
  mode?: EventMode
  status?: EventStatus
  startsAtMin?: string
  startsAtMax?: string
  search?: string
  sort?:
    | 'startsAt'
    | 'createdAt'
    | 'rsvpsCount'
    | 'rsvpsGoingCount'
    | 'rsvpsInterestedCount'
  order?: 'asc' | 'desc'
  /**
   * Only events authored by this DID or handle. Not in contrail's API.md, but
   * supported by `event.listRecords`.
   */
  actor?: string
  profiles?: boolean
  hydrateRsvps?: number
  limit?: number
  cursor?: string
}

/** The signed-in user's RSVP to one event, read from their own repo. */
export type ViewerRsvp = {
  status: RsvpStatus
  /**
   * Record keys of every RSVP record the user has for this event, newest
   * first. Other clients can leave duplicates behind; we update the newest and
   * delete them all when removing the RSVP.
   */
  rkeys: string[]
}

/** The signed-in user's RSVPs, keyed by event AT-URI. */
export type ViewerRsvps = Record<string, ViewerRsvp>
