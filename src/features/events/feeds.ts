import {type Props as IconProps} from '#/components/icons/common'
import {FortyVerse} from '#/components/icons/community/FortyVerse'
import {getTimelineFeed, listEvents, listEventsByLocation} from './api'
import {
  type EventListParams,
  type EventRecord,
  type ListResponse,
} from './types'

export type EventFeedId = 'upcoming' | 'following' | '40verse' | 'mine'

/** The selectable feeds, in tab order. */
export const EVENT_FEED_IDS: EventFeedId[] = [
  'upcoming',
  'following',
  '40verse',
  'mine',
]

/** Per-user context a feed may need to fetch. */
export type EventFeedContext = {
  /** DID of the signed-in account; set whenever a feed requires auth. */
  actor?: string
}

/**
 * How each feed fetches a page. The shared params (date range, sort, paging)
 * come from the query hook; a feed only picks its endpoint and adds its own
 * filters. Every endpoint returns the same `{records, cursor}` envelope.
 */
export const EVENT_FEEDS: Record<
  EventFeedId,
  {
    /** Optional logo shown before the feed's label in the tab. */
    icon?: React.ComponentType<IconProps>
    /** Hidden when signed out; `ctx.actor` is always set when it fetches. */
    requiresAuth?: boolean
    fetch: (
      params: EventListParams,
      ctx: EventFeedContext,
      signal?: AbortSignal,
    ) => Promise<ListResponse<EventRecord>>
  }
> = {
  upcoming: {
    fetch: (params, _ctx, signal) => listEvents(params, signal),
  },
  following: {
    requiresAuth: true,
    fetch: (params, {actor}, signal) =>
      getTimelineFeed({...params, actor: actor!}, signal),
  },
  '40verse': {
    icon: FortyVerse,
    fetch: (params, _ctx, signal) =>
      listEventsByLocation({...params, location: 'amsterdam'}, signal),
  },
  mine: {
    requiresAuth: true,
    // Everything the user organised, past events included, latest first.
    fetch: (params, {actor}, signal) =>
      listEvents(
        {...params, actor, startsAtMin: undefined, order: 'desc'},
        signal,
      ),
  },
}
