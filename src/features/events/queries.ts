import {jsonToLex, type LexMap, lexToJson} from '@atproto/lex'
import {AtUri} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import * as Toast from '#/components/Toast'
import {com} from '#/lexicons'
import {getEvent} from './api'
import {
  type EventFormValues,
  toRecord,
} from './components/CreateOrEditEventDialog/form'
import {EVENT_NSID, EVENTS_PAGE_SIZE, RSVP_NSID} from './config'
import {EVENT_FEEDS, type EventFeedId} from './feeds'
import {type EventFilters} from './filters'
import {
  type Blob as BlobJson,
  type EventRecord,
  type GetRecordResponse,
  type ListResponse,
  type RsvpStatus,
  type ViewerRsvp,
  type ViewerRsvps,
} from './types'
import {applyRsvpChange} from './util'

const eventFeedQueryKeyRoot = 'eventFeed'
const eventQueryKeyRoot = 'event'
const viewerEventRsvpsQueryKeyRoot = 'viewerEventRsvps'

/**
 * Every feed shares the `eventFeed` root, so all feeds can be invalidated at
 * once with `{queryKey: ['eventFeed']}`.
 */
export const createEventFeedQueryKey = (args: {
  feed: EventFeedId
  filters: EventFilters
  startsAtMin: string
  actor?: string
}) => createQueryKey(eventFeedQueryKeyRoot, args)

export const createEventQueryKey = (args: {uri: string}) =>
  createQueryKey(eventQueryKeyRoot, args)

export const createViewerEventRsvpsQueryKey = (args: {did?: string}) =>
  createQueryKey(viewerEventRsvpsQueryKeyRoot, args)

/** A page-by-page list of the events in the given feed, narrowed by `filters`. */
export function useEventFeedQuery(feed: EventFeedId, filters: EventFilters) {
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
    queryKey: createEventFeedQueryKey({feed, filters, startsAtMin, actor}),
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
        filters,
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

/**
 * All of the signed-in user's RSVPs, read from their own repo rather than the
 * AppView, which lags behind writes.
 */
export function useViewerEventRsvpsQuery<T = ViewerRsvps>({
  select,
}: {
  select?: (data: ViewerRsvps) => T
} = {}) {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useQuery({
    queryKey: createViewerEventRsvpsQueryKey({did}),
    enabled: !!did,
    queryFn: async ({signal}) => {
      const rsvps: ViewerRsvps = {}
      let cursor: string | undefined
      do {
        const res = await pdsClient.call(
          com.atproto.repo.listRecords,
          {repo: did!, collection: RSVP_NSID, limit: 100, cursor},
          {signal},
        )
        // Records come newest first, so the first one per event wins.
        for (const record of res.records) {
          const value = record.value as {
            status?: RsvpStatus
            subject?: {uri?: string}
          }
          const eventUri = value.subject?.uri
          if (!eventUri || !value.status) continue
          const rkey = new AtUri(record.uri).rkey
          if (rsvps[eventUri]) {
            rsvps[eventUri].rkeys.push(rkey)
          } else {
            rsvps[eventUri] = {status: value.status, rkeys: [rkey]}
          }
        }
        cursor = res.cursor
      } while (cursor)
      return rsvps
    },
    select,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * Sets the signed-in user's RSVP to an event, or removes it when `next` is
 * null. Updates the viewer's RSVPs and every cached feed optimistically.
 */
export function useEventRsvpMutation() {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const {t: l} = useLingui()
  const did = currentAccount?.did
  const viewerKey = createViewerEventRsvpsQueryKey({did})
  const feedsKey = [eventFeedQueryKeyRoot]

  const setViewerRsvp = (eventUri: string, rsvp: ViewerRsvp | null) => {
    queryClient.setQueryData<ViewerRsvps>(viewerKey, old => {
      const {[eventUri]: _, ...rest} = old ?? {}
      return rsvp ? {...rest, [eventUri]: rsvp} : rest
    })
  }

  return useMutation({
    mutationFn: async ({
      event,
      prev,
      next,
    }: {
      event: EventRecord
      prev?: ViewerRsvp
      next: RsvpStatus | null
    }): Promise<ViewerRsvp | null> => {
      if (!did) throw new Error('Not signed in')

      if (!next) {
        await Promise.all(
          (prev?.rkeys ?? []).map(rkey =>
            pdsClient.call(com.atproto.repo.deleteRecord, {
              repo: did,
              collection: RSVP_NSID,
              rkey,
            }),
          ),
        )
        return null
      }

      const record = {
        $type: RSVP_NSID,
        status: next,
        subject: {uri: event.uri, cid: event.cid},
      }
      const [rkey] = prev?.rkeys ?? []
      if (rkey) {
        await pdsClient.call(com.atproto.repo.putRecord, {
          repo: did,
          collection: RSVP_NSID,
          rkey,
          record,
        })
        return {status: next, rkeys: prev!.rkeys}
      }
      const res = await pdsClient.call(com.atproto.repo.createRecord, {
        repo: did,
        collection: RSVP_NSID,
        record,
      })
      return {status: next, rkeys: [new AtUri(res.uri).rkey]}
    },
    onMutate: async ({event, prev, next}) => {
      await Promise.all([
        queryClient.cancelQueries({queryKey: viewerKey}),
        queryClient.cancelQueries({queryKey: feedsKey}),
      ])
      const prevViewer = queryClient.getQueryData<ViewerRsvps>(viewerKey)
      const prevFeeds = queryClient.getQueriesData<EventFeedData>({
        queryKey: feedsKey,
      })

      setViewerRsvp(
        event.uri,
        next ? {status: next, rkeys: prev?.rkeys ?? []} : null,
      )
      // A shared root, so this updates the event in every feed it appears in.
      queryClient.setQueriesData<EventFeedData>({queryKey: feedsKey}, data =>
        data
          ? {
              ...data,
              pages: data.pages.map(page => ({
                ...page,
                records: page.records.map(record =>
                  record.uri === event.uri
                    ? applyRsvpChange(record, prev?.status ?? null, next)
                    : record,
                ),
              })),
            }
          : data,
      )

      return {prevViewer, prevFeeds}
    },
    onSuccess: (result, {event}) => {
      /*
       * Write through the real record keys. We don't refetch the feeds: the
       * AppView hasn't indexed the write yet and would undo the counts.
       */
      setViewerRsvp(event.uri, result)
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(viewerKey, context.prevViewer)
        for (const [key, data] of context.prevFeeds) {
          queryClient.setQueryData(key, data)
        }
      }
      Toast.show(l`Couldn’t update your RSVP`, {type: 'error'})
    },
  })
}

type EventFeedData = InfiniteData<ListResponse<EventRecord>>

/**
 * Creates an event, or replaces it when `existing` is passed, in the
 * signed-in user's repo. Resolves to the saved event, already written into
 * the cached feeds.
 */
export function useEventSaveMutation() {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useMutation({
    mutationFn: async ({
      values,
      existing,
    }: {
      values: EventFormValues
      existing?: EventRecord
    }): Promise<EventRecord> => {
      if (!did) throw new Error('Not signed in')

      const upload = values.image?.upload
      const uploadedImage = upload
        ? (lexToJson(
            (await uploadBlob(pdsClient, upload.path, upload.mime)).blob,
          ) as BlobJson)
        : undefined
      const record = toRecord(values, existing, uploadedImage)
      /*
       * The record is plain JSON, as the AppView serves it; convert its blob
       * refs and links back to lex values for the write.
       */
      const lexRecord = jsonToLex(JSON.parse(JSON.stringify(record))) as LexMap

      const {uri, cid} = existing
        ? await pdsClient.call(com.atproto.repo.putRecord, {
            repo: did,
            collection: EVENT_NSID,
            rkey: existing.rkey,
            record: lexRecord,
            // Fail rather than overwrite an edit made elsewhere.
            swapRecord: existing.cid,
          })
        : await pdsClient.call(com.atproto.repo.createRecord, {
            repo: did,
            collection: EVENT_NSID,
            record: lexRecord,
          })

      return {
        // Keeps the RSVP counts when editing.
        ...existing,
        uri,
        cid,
        did,
        collection: EVENT_NSID,
        rkey: new AtUri(uri).rkey,
        time_us: Date.now() * 1000,
        value: record,
      }
    },
    onSuccess: (event, {existing}) => {
      /*
       * Write the event into the cache rather than refetching: the AppView
       * hasn't indexed the write yet, so a refetch would drop it.
       */
      queryClient.setQueryData<GetRecordResponse<EventRecord>>(
        createEventQueryKey({uri: event.uri}),
        old => ({...old, ...event}),
      )
      if (existing) {
        queryClient.setQueriesData<EventFeedData>(
          {queryKey: [eventFeedQueryKeyRoot]},
          data =>
            data
              ? {
                  ...data,
                  pages: data.pages.map(page => ({
                    ...page,
                    records: page.records.map(record =>
                      record.uri === event.uri ? event : record,
                    ),
                  })),
                }
              : data,
        )
      } else {
        // New events go to the top of "My events", which is newest first.
        queryClient.setQueriesData<EventFeedData>(
          {queryKey: [eventFeedQueryKeyRoot, {feed: 'mine'}]},
          data =>
            data
              ? {
                  ...data,
                  pages: data.pages.map((page, i) =>
                    i === 0
                      ? {...page, records: [event, ...page.records]}
                      : page,
                  ),
                }
              : data,
        )
      }
    },
  })
}
