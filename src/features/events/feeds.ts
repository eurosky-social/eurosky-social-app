import {type Props as IconProps} from '#/components/icons/common'
import {FortyVerse} from '#/components/icons/community/FortyVerse'
import {listEvents, listEventsByLocation} from './api'
import {
  type EventListParams,
  type EventRecord,
  type ListResponse,
} from './types'

export type EventFeedId = 'upcoming' | '40verse'

/** The selectable feeds, in tab order. */
export const EVENT_FEED_IDS: EventFeedId[] = ['upcoming', '40verse']

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
    fetch: (
      params: EventListParams,
      signal?: AbortSignal,
    ) => Promise<ListResponse<EventRecord>>
  }
> = {
  upcoming: {
    fetch: (params, signal) => listEvents(params, signal),
  },
  '40verse': {
    icon: FortyVerse,
    fetch: (params, signal) =>
      listEventsByLocation({...params, location: 'amsterdam'}, signal),
  },
}
