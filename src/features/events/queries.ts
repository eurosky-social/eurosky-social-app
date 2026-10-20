import {
  type Client,
  jsonToLex,
  type LexMap,
  lexToJson,
  type UriString,
} from '@atproto/lex'
import {type AtIdentifierString, AtUri} from '@atproto/syntax'
import {moderatePost} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {BLUESKY_APPVIEW_SERVICE} from '#/lib/constants'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import * as Toast from '#/components/Toast'
import {app, com} from '#/lexicons'
import {getEvent, getFollowingRsvps, listRsvps} from './api'
import {
  type EventFormValues,
  toRecord,
} from './components/CreateOrEditEventDialog/form'
import {
  EVENT_ATTENDEES_SHOWN,
  EVENT_NSID,
  EVENT_RSVPS_PAGE_SIZE,
  EVENTS_PAGE_SIZE,
  RSVP_NSID,
} from './config'
import {EVENT_FEEDS, type EventFeedId} from './feeds'
import {type EventFilters, type EventSort, toEventSortParams} from './filters'
import {
  type Blob as BlobJson,
  type EventProfile,
  type EventRecord,
  type FollowingRsvp,
  type GetRecordResponse,
  type ListResponse,
  type RsvpStatus,
  type ViewerRsvp,
  type ViewerRsvps,
} from './types'
import {applyRsvpChange, getEventShareUrls} from './util'

const eventFeedQueryKeyRoot = 'eventFeed'
const eventQueryKeyRoot = 'event'
const viewerEventRsvpsQueryKeyRoot = 'viewerEventRsvps'
const eventPostsQueryKeyRoot = 'eventPosts'
const followingEventRsvpsQueryKeyRoot = 'followingEventRsvps'
const eventRsvpsQueryKeyRoot = 'eventRsvps'
const eventFriendRsvpsQueryKeyRoot = 'eventFriendRsvps'

/**
 * Every feed shares the `eventFeed` root, so all feeds can be invalidated at
 * once with `{queryKey: ['eventFeed']}`.
 */
export const createEventFeedQueryKey = (args: {
  feed: EventFeedId
  filters: EventFilters
  sort: EventSort
  startsAtMin: string
  actor?: string
}) => createQueryKey(eventFeedQueryKeyRoot, args)

export const createEventQueryKey = (args: {uri: string}) =>
  createQueryKey(eventQueryKeyRoot, args)

export const createEventPostsQueryKey = (args: {
  uri: string
  pageSize: number
}) => createQueryKey(eventPostsQueryKeyRoot, args)

export const createFollowingEventRsvpsQueryKey = (args: {actor?: string}) =>
  createQueryKey(followingEventRsvpsQueryKeyRoot, args)

export const createEventRsvpsQueryKey = (args: {
  uri: string
  status: EventRsvpsStatus
}) => createQueryKey(eventRsvpsQueryKeyRoot, args)

export const createEventFriendRsvpsQueryKey = (args: {
  uri: string
  actor?: string
}) => createQueryKey(eventFriendRsvpsQueryKeyRoot, args)

export const createViewerEventRsvpsQueryKey = (args: {did?: string}) =>
  createQueryKey(viewerEventRsvpsQueryKeyRoot, args)

/**
 * A page-by-page list of the events in the given feed, narrowed by `filters`
 * and ordered by `sort`.
 */
export function useEventFeedQuery(
  feed: EventFeedId,
  filters: EventFilters,
  sort: EventSort,
) {
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
    queryKey: createEventFeedQueryKey({
      feed,
      filters,
      sort,
      startsAtMin,
      actor,
    }),
    enabled: !requiresAuth || !!actor,
    queryFn: ({pageParam, signal}) =>
      fetch(
        {
          startsAtMin,
          ...toEventSortParams(sort),
          profiles: true,
          hydrateRsvps: EVENT_ATTENDEES_SHOWN,
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

/**
 * A single event by AT-URI, with its organiser's profile. Waits while `uri` is
 * undefined, e.g. until a handle in the URL has resolved.
 */
export function useEventQuery({uri}: {uri?: string}) {
  return useQuery({
    queryKey: createEventQueryKey({uri: uri ?? ''}),
    enabled: !!uri,
    queryFn: ({signal}) =>
      getEvent(
        {uri: uri!, profiles: true, hydrateRsvps: EVENT_ATTENDEES_SHOWN},
        signal,
      ),
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * Bluesky posts that link to the event's page on another events app, page by
 * page in the order post search returns them. Several URLs in one search match
 * any of them. Posts that moderation filters out of lists are dropped, as in
 * search, so a page can hold fewer than `pageSize` posts.
 */
export function useEventPostsQuery({
  event,
  profile,
  pageSize,
}: {
  event: EventRecord
  profile?: EventProfile
  pageSize: number
}) {
  const client = useAppviewClient()
  const {hasSession} = useSession()
  const moderationOpts = useModerationOpts()

  return useInfiniteQuery({
    // The page size is part of the key, so previews and full lists don't mix.
    queryKey: createEventPostsQueryKey({uri: event.uri, pageSize}),
    // Bluesky's post search requires authentication.
    enabled: hasSession && !!moderationOpts,
    queryFn: ({pageParam}) =>
      client.call(
        app.bsky.feed.searchPostsV2,
        {
          urls: getEventShareUrls(event, profile) as UriString[],
          limit: pageSize,
          cursor: pageParam,
          // Without this, search only covers recent posts.
          allTime: true,
        },
        {service: BLUESKY_APPVIEW_SERVICE},
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.cursor,
    select: data => ({
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        posts: page.posts.filter(
          post =>
            !moderationOpts ||
            !moderatePost(post, moderationOpts).ui('contentList').filter,
        ),
      })),
    }),
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * Seeds the cache for a single event with the record a feed already has, so
 * its page renders straight away. The feed's copy carries any optimistic RSVP
 * changes, so it replaces whatever was cached before.
 */
export function usePrecacheEvent() {
  const queryClient = useQueryClient()
  return (event: EventRecord, profile?: EventProfile) => {
    queryClient.setQueryData<GetRecordResponse<EventRecord>>(
      createEventQueryKey({uri: event.uri}),
      {...event, profiles: profile ? [profile] : undefined},
    )
  }
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
 * RSVPs by everyone the signed-in user follows, to all upcoming events in one
 * request, so every event shares it.
 */
export function useFollowingEventRsvpsQuery<T = FollowingRsvp[]>({
  select,
}: {
  select?: (data: FollowingRsvp[]) => T
} = {}) {
  const {currentAccount} = useSession()
  const actor = currentAccount?.did

  return useQuery({
    queryKey: createFollowingEventRsvpsQueryKey({actor}),
    enabled: !!actor,
    queryFn: async ({signal}) =>
      (await getFollowingRsvps({actor: actor!}, signal)).attendees,
    select,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/** The RSVP statuses listed on an event's RSVPs screen. */
export type EventRsvpsStatus = 'going' | 'interested'

type ProfileView = app.bsky.actor.defs.ProfileViewDetailed

/**
 * Bluesky profiles for `dids`, in the same order. Accounts getProfiles can't
 * find are left out.
 */
async function getProfilesInOrder(
  client: Client,
  dids: string[],
  signal?: AbortSignal,
): Promise<ProfileView[]> {
  const chunks: string[][] = []
  for (let i = 0; i < dids.length; i += 25) chunks.push(dids.slice(i, i + 25))
  const results = await Promise.all(
    chunks.map(actors =>
      client.call(
        app.bsky.actor.getProfiles,
        {actors: actors as AtIdentifierString[]},
        {signal},
      ),
    ),
  )
  const byDid = new Map<string, ProfileView>(
    results.flatMap(res => res.profiles).map(p => [p.did, p]),
  )
  return dids.flatMap(did => byDid.get(did) ?? [])
}

/**
 * Everyone who RSVP'd `status` to an event, page by page, as Bluesky
 * profiles. A person with several records can show up on more than one page,
 * so dedupe on `did` when flattening.
 */
export function useEventRsvpsQuery({
  uri,
  status,
  enabled = true,
}: {
  uri: string
  status: EventRsvpsStatus
  enabled?: boolean
}) {
  const client = useAppviewClient()

  return useInfiniteQuery({
    queryKey: createEventRsvpsQueryKey({uri, status}),
    enabled,
    queryFn: async ({pageParam, signal}) => {
      const page = await listRsvps(
        {
          subjectUri: uri,
          status: `community.lexicon.calendar.rsvp#${status}`,
          limit: EVENT_RSVPS_PAGE_SIZE,
          cursor: pageParam,
        },
        signal,
      )
      const dids = [...new Set(page.records.map(record => record.did))]
      return {
        profiles: await getProfilesInOrder(client, dids, signal),
        cursor: page.cursor,
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.cursor,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * The people the signed-in user follows who RSVP'd to an event, as Bluesky
 * profiles grouped by status.
 */
export function useEventFriendRsvpsQuery({event}: {event: EventRecord}) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const actor = currentAccount?.did

  return useQuery({
    queryKey: createEventFriendRsvpsQueryKey({uri: event.uri, actor}),
    enabled: !!actor,
    queryFn: async ({signal}) => {
      const {attendees} = await getFollowingRsvps(
        {actor: actor!, ...getStartDayRange(event)},
        signal,
      )
      const rsvps = attendees.filter(rsvp => rsvp.eventUri === event.uri)
      const profiles = await getProfilesInOrder(
        client,
        rsvps.map(rsvp => rsvp.did),
        signal,
      )
      const statusOf = new Map(rsvps.map(rsvp => [rsvp.did, rsvp.status]))
      return {
        going: profiles.filter(p => statusOf.get(p.did) === 'going'),
        interested: profiles.filter(p => statusOf.get(p.did) === 'interested'),
      } satisfies Record<EventRsvpsStatus, ProfileView[]>
    },
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * Bounds that select the day the event starts on, so `followingRsvps` only
 * returns RSVPs to events that day, past ones included. startsAt is compared
 * as a string, so the bare dates cover the whole day. Malformed start times
 * get no bounds, which means upcoming events.
 */
function getStartDayRange(event: EventRecord) {
  const {startsAt} = event.value
  if (typeof startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(startsAt)) {
    return {}
  }
  const startsAtMin = startsAt.slice(0, 10)
  const nextDay = new Date(`${startsAtMin}T00:00:00Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  return {startsAtMin, startsAtMax: nextDay.toISOString().slice(0, 10)}
}

/**
 * Every cached copy of `did`'s profile in the RSVP lists, so profile shadows
 * (e.g. following someone from the list) apply to them.
 */
export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<ProfileView, void> {
  for (const [_key, data] of queryClient.getQueriesData<
    InfiniteData<{profiles: ProfileView[]}>
  >({queryKey: [eventRsvpsQueryKeyRoot]})) {
    for (const page of data?.pages ?? []) {
      for (const profile of page.profiles) {
        if (profile.did === did) yield profile
      }
    }
  }
  for (const [_key, data] of queryClient.getQueriesData<
    Record<EventRsvpsStatus, ProfileView[]>
  >({queryKey: [eventFriendRsvpsQueryKeyRoot]})) {
    for (const profile of [
      ...(data?.going ?? []),
      ...(data?.interested ?? []),
    ]) {
      if (profile.did === did) yield profile
    }
  }
}

/**
 * Sets the signed-in user's RSVP to an event, or removes it when `next` is
 * null. Updates the viewer's RSVPs, every cached feed and the cached event
 * optimistically.
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
      const eventKey = createEventQueryKey({uri: event.uri})
      await Promise.all([
        queryClient.cancelQueries({queryKey: viewerKey}),
        queryClient.cancelQueries({queryKey: feedsKey}),
        queryClient.cancelQueries({queryKey: eventKey}),
      ])
      const prevViewer = queryClient.getQueryData<ViewerRsvps>(viewerKey)
      const prevFeeds = queryClient.getQueriesData<EventFeedData>({
        queryKey: feedsKey,
      })
      const prevEvent =
        queryClient.getQueryData<GetRecordResponse<EventRecord>>(eventKey)

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
      queryClient.setQueryData<GetRecordResponse<EventRecord>>(
        eventKey,
        data => data && applyRsvpChange(data, prev?.status ?? null, next),
      )

      return {prevViewer, prevFeeds, eventKey, prevEvent}
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
        queryClient.setQueryData(context.eventKey, context.prevEvent)
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
