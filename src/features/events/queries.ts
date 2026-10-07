import {useInfiniteQuery, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {getEvent, listEvents} from './api'
import {EVENTS_PAGE_SIZE} from './config'

const upcomingEventsQueryKeyRoot = 'upcomingEvents'
const eventQueryKeyRoot = 'event'

export const createUpcomingEventsQueryKey = (args: {startsAtMin: string}) =>
  createQueryKey(upcomingEventsQueryKeyRoot, args)

export const createEventQueryKey = (args: {uri: string}) =>
  createQueryKey(eventQueryKeyRoot, args)

/** Upcoming events, soonest first. */
export function useUpcomingEventsQuery() {
  /*
   * Day granularity keeps the query key stable across renders. startsAt is
   * compared as a string, so a bare date includes all of today.
   */
  const startsAtMin = new Date().toISOString().slice(0, 10)

  return useInfiniteQuery({
    queryKey: createUpcomingEventsQueryKey({startsAtMin}),
    queryFn: ({pageParam, signal}) =>
      listEvents(
        {
          startsAtMin,
          sort: 'startsAt',
          order: 'asc',
          profiles: true,
          limit: EVENTS_PAGE_SIZE,
          cursor: pageParam,
        },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.cursor,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/** A single event by AT-URI, with its organiser's profile. */
export function useEventQuery({uri}: {uri: string}) {
  return useQuery({
    queryKey: createEventQueryKey({uri}),
    queryFn: ({signal}) => getEvent({uri, profiles: true}, signal),
    staleTime: STALE.MINUTES.FIVE,
  })
}
