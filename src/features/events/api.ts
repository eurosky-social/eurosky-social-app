import {EVENTS_APPVIEW_URL, EVENTS_NAMESPACE} from './config'
import {
  type EventListParams,
  type EventRecord,
  type FollowingRsvp,
  type GetRecordResponse,
  type ListResponse,
  type RsvpRecord,
  type RsvpStatus,
} from './types'

type Params = Record<string, string | number | boolean | undefined>

/** Error returned by the events AppView, carrying its `error` message. */
export class EventsApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'EventsApiError'
  }
}

async function xrpcGet<T>(
  method: string,
  params: Params,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`/xrpc/${EVENTS_NAMESPACE}.${method}`, EVENTS_APPVIEW_URL)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.href, {signal})
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new EventsApiError(body?.error ?? res.statusText, res.status)
  }
  return (await res.json()) as T
}

export function listEvents(params: EventListParams, signal?: AbortSignal) {
  return xrpcGet<ListResponse<EventRecord>>('event.listRecords', params, signal)
}

export function listEventsByLocation(
  params: EventListParams & {location?: string; country?: string},
  signal?: AbortSignal,
) {
  return xrpcGet<ListResponse<EventRecord>>('event.byLocation', params, signal)
}

/**
 * Events hosted by everyone `actor` follows. On the first call for an actor
 * contrail hasn't seen, this returns an empty list while it loads their
 * follows in the background.
 */
export function getTimelineFeed(
  params: EventListParams & {actor: string},
  signal?: AbortSignal,
) {
  return xrpcGet<ListResponse<EventRecord>>(
    'getFeed',
    {...params, feed: 'timeline'},
    signal,
  )
}

export function getEvent(
  params: {uri: string; profiles?: boolean; hydrateRsvps?: number},
  signal?: AbortSignal,
) {
  return xrpcGet<GetRecordResponse<EventRecord>>(
    'event.getRecord',
    params,
    signal,
  )
}

/**
 * RSVP records, e.g. to one event with `subjectUri`. One person can hold
 * several records for the same event, so dedupe on `did`.
 */
export function listRsvps(
  params: {
    subjectUri?: string
    status?: RsvpStatus
    limit?: number
    cursor?: string
  },
  signal?: AbortSignal,
) {
  return xrpcGet<ListResponse<RsvpRecord>>('rsvp.listRecords', params, signal)
}

/**
 * Every RSVP by anyone `actor` follows, to upcoming events unless
 * `startsAtMin`/`startsAtMax` say otherwise. Not paginated.
 */
export function getFollowingRsvps(
  params: {actor: string; startsAtMin?: string; startsAtMax?: string},
  signal?: AbortSignal,
) {
  return xrpcGet<{attendees: FollowingRsvp[]}>(
    'event.followingRsvps',
    params,
    signal,
  )
}
