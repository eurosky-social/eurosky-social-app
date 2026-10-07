import {useInfiniteQuery, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {getEvent} from './api'
import {EVENTS_PAGE_SIZE} from './config'
import {EVENT_FEEDS, type EventFeedId} from './feeds'

const eventFeedQueryKeyRoot = 'eventFeed'
const eventQueryKeyRoot = 'event'

/**
 * Every feed shares the `eventFeed` root, so all feeds can be invalidated at
 * once with `{queryKey: ['eventFeed']}`.
 */
export const createEventFeedQueryKey = (args: {
  feed: EventFeedId
  startsAtMin: string
  actor?: string
}) => createQueryKey(eventFeedQueryKeyRoot, args)

export const createEventQueryKey = (args: {uri: string}) =>
  createQueryKey(eventQueryKeyRoot, args)

/** A page-by-page list of the events in the given feed. */
export function useEventFeedQuery(feed: EventFeedId) {
  const {currentAccount} = useSession()
  const {requiresAuth, fetch} = EVENT_FEEDS[feed]
  // Only per-user feeds key on the account, so shared feeds share one cache.
  const actor = requiresAuth ? currentAccount?.did : undefined

  /*
   * Day granularity keeps the query key stable across renders. startsAt is
   * compared as a string, so a bare date includes all of today.
   */
  const startsAtMin = new Date().toISOString().slice(0, 10)

  return useInfiniteQuery({
    queryKey: createEventFeedQueryKey({feed, startsAtMin, actor}),
    enabled: !requiresAuth || !!actor,
    queryFn: ({pageParam, signal}) =>
      fetch(
        {
          startsAtMin,
          sort: 'startsAt',
          order: 'asc',
          profiles: true,
          limit: EVENTS_PAGE_SIZE,
          cursor: pageParam,
        },
        {actor},
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
