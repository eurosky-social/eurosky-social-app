import {type Props as IconProps} from '#/components/icons/common'
import {FortyVerse} from '#/components/icons/community/FortyVerse'
import {getTimelineFeed, listEventsByLocation} from './api'
import {type EventFilters} from './filters'
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
 *
 * `filters` are the user's filters, passed to every feed. `byLocation` with no
 * location behaves like `listRecords`, so feeds that support them always call it.
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
      filters: EventFilters,
      ctx: EventFeedContext,
      signal?: AbortSignal,
    ) => Promise<ListResponse<EventRecord>>
  }
> = {
  upcoming: {
    fetch: (params, filters, _ctx, signal) =>
      listEventsByLocation({...params, ...filters}, signal),
  },
  following: {
    requiresAuth: true,
    fetch: (params, filters, {actor}, signal) => {
      if (filters.location) {
        // getFeed has no location param; followingFeed does, but also lists RSVPs.
        console.warn('Events: the location filter is ignored by this feed')
      }
      return getTimelineFeed({...params, actor: actor!}, signal)
    },
  },
  '40verse': {
    icon: FortyVerse,
    fetch: (params, filters, _ctx, signal) =>
      listEventsByLocation(
        // The 40verse feed is currently implemented as just a filter on Amsterdan in lieu of
        // actual curation.
        {...params, ...filters, location: 'amsterdam'},
        signal,
      ),
  },
  mine: {
    requiresAuth: true,
    // Everything the user organised, past events included, latest first.
    fetch: (params, filters, {actor}, signal) =>
      listEventsByLocation(
        {...params, ...filters, actor, startsAtMin: undefined, order: 'desc'},
        signal,
      ),
  },
}
