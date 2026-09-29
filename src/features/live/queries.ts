import {TID} from '@atproto/common-web'
import {type UriString} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import chunk from 'lodash.chunk'
import {z} from 'zod'

import {createServiceClient} from '#/lib/lexClient'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {resolveDidServiceEndpoint} from '#/state/session/identity-resolver'
import {engagementScore} from '#/features/newsrooms/postLinks'
import {app, com, social} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {
  LIVE_CURATOR_HANDLE,
  LIVE_EVENT_NSID,
  LIVE_SOURCES_LIST_URI,
  type LiveEvent,
  liveEventFromPost,
  liveEventFromRecord,
  postReferencesStream,
  streamKey,
  streamUrlVariants,
} from './events'

/* -------------------------------------------------------------------------
 * The curator account
 * ---------------------------------------------------------------------- */

export const createLiveCuratorQueryKey = () =>
  createQueryKey('liveCurator', {handle: LIVE_CURATOR_HANDLE})

export type LiveCurator = {did: string; pds: string}

/**
 * Resolves the curator handle to its DID and PDS endpoint once per hour.
 * The event records are read from that PDS directly, so no appview needs
 * to know about the collection.
 */
export function useLiveCuratorQuery() {
  const client = useAppviewClient()
  return useQuery({
    queryKey: createLiveCuratorQueryKey(),
    staleTime: STALE.HOURS.ONE,
    queryFn: async (): Promise<LiveCurator> => {
      const {did} = await client.call(com.atproto.identity.resolveHandle, {
        handle: LIVE_CURATOR_HANDLE,
      })
      const pds = await resolveDidServiceEndpoint({
        did,
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
      })
      if (!pds) throw new Error('The curator account has no PDS endpoint')
      return {did, pds}
    },
  })
}

/** Whether the signed-in account is the curator, and so may edit events. */
export function useIsLiveCurator(): boolean {
  const {currentAccount} = useSession()
  const {data: curator} = useLiveCuratorQuery()
  return !!currentAccount && !!curator && currentAccount.did === curator.did
}

/* -------------------------------------------------------------------------
 * Sources: the list of accounts whose stream posts are events
 * ---------------------------------------------------------------------- */

export const createLiveSourcesQueryKey = () =>
  createQueryKey('liveSources', {list: LIVE_SOURCES_LIST_URI})

/**
 * The DIDs on the curated accounts list, read from the list owner's repo
 * (`app.bsky.graph.listitem` records for that list) so a change to the list
 * shows up without waiting for an appview to index it.
 */
export function useLiveSourcesQuery() {
  return useQuery({
    queryKey: createLiveSourcesQueryKey(),
    staleTime: STALE.MINUTES.FIVE,
    queryFn: async (): Promise<string[]> => {
      const [, ownerDid] = LIVE_SOURCES_LIST_URI.replace('at://', '/').split(
        '/',
      )
      const pdsUrl = await resolveDidServiceEndpoint({
        did: ownerDid,
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
      })
      if (!pdsUrl) throw new Error('The list owner has no PDS endpoint')
      const pds = createServiceClient(pdsUrl)
      const dids = new Set<string>()
      let cursor: string | undefined
      do {
        const data = await pds.call(com.atproto.repo.listRecords, {
          repo: ownerDid as DidString,
          collection: 'app.bsky.graph.listitem',
          limit: 100,
          cursor,
        })
        for (const {value} of data.records) {
          const parsed = listItemSchema.safeParse(value)
          if (parsed.success && parsed.data.list === LIVE_SOURCES_LIST_URI) {
            dids.add(parsed.data.subject)
          }
        }
        cursor = data.cursor
      } while (cursor)
      return Array.from(dids)
    },
  })
}

const listItemSchema = z.object({list: z.string(), subject: z.string()})

/* -------------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------- */

export const createLiveEventsQueryKey = (args: {
  curatorDid?: string
  sources?: string[]
}) => createQueryKey('liveEvents', args)

/** Accounts are read in parallel; bound how many run at once. */
const FEED_CONCURRENCY = 8
/** How many recent posts per source account to scan for stream links. */
const POSTS_PER_SOURCE = 30

/**
 * The programme, newest first: every `social.mu.live.event` record in the
 * curator's repo, plus an event for each stream post from the curator and
 * from every account on the sources list. Posts are read from each
 * account's own PDS rather than the appview, which can lag hours behind for
 * some hosts. Keyed by stream, so a record for a stream someone already
 * posted supersedes the post-derived event and keeps its id as an alias.
 */
export function useLiveEventsQuery() {
  const {data: curator} = useLiveCuratorQuery()
  const {data: sources} = useLiveSourcesQuery()
  return useQuery({
    queryKey: createLiveEventsQueryKey({curatorDid: curator?.did, sources}),
    staleTime: STALE.MINUTES.ONE,
    refetchInterval: STALE.MINUTES.FIVE,
    enabled: !!curator && !!sources,
    queryFn: async (): Promise<LiveEvent[]> => {
      const pds = createServiceClient(curator!.pds)
      const accounts = Array.from(new Set([curator!.did, ...sources!]))
      const [records, posts] = await Promise.all([
        listEventRecords(pds, curator!),
        listAccountPostEvents(accounts),
      ])

      const byStream = new Map<string, LiveEvent>()
      const loose: LiveEvent[] = []
      const place = (event: LiveEvent) => {
        const key = streamKey(event.streamUrl)
        if (!key) {
          loose.push(event)
          return
        }
        const existing = byStream.get(key)
        if (!existing) {
          byStream.set(key, event)
          return
        }
        // Records win over posts; among posts the newest wins.
        const winner = existing.fromRecord
          ? existing
          : event.fromRecord
            ? event
            : new Date(event.startsAt) > new Date(existing.startsAt)
              ? event
              : existing
        const loser = winner === existing ? event : existing
        byStream.set(key, {
          ...winner,
          anchorPostUri: winner.anchorPostUri ?? loser.anchorPostUri,
          aliasIds: [
            ...(winner.aliasIds ?? []),
            loser.id,
            ...(loser.aliasIds ?? []),
          ],
        })
      }
      for (const event of records) place(event)
      for (const event of posts) place(event)

      return [...byStream.values(), ...loose].sort(
        (a, b) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      )
    },
  })
}

/** One event by id (a record key or a post key), from the cached list. */
export function useLiveEventQuery(id: string | undefined) {
  const curator = useLiveCuratorQuery()
  const sources = useLiveSourcesQuery()
  const events = useLiveEventsQuery()
  const data = id
    ? (events.data?.find(
        event => event.id === id || event.aliasIds?.includes(id),
      ) ?? null)
    : null
  return {
    data,
    isLoading: curator.isLoading || sources.isLoading || events.isLoading,
    error: curator.error ?? sources.error ?? events.error,
  }
}

async function listEventRecords(
  pds: ReturnType<typeof createServiceClient>,
  curator: LiveCurator,
): Promise<LiveEvent[]> {
  const events: LiveEvent[] = []
  let cursor: string | undefined
  do {
    const data = await pds.call(com.atproto.repo.listRecords, {
      repo: curator.did as DidString,
      collection: LIVE_EVENT_NSID,
      limit: 100,
      cursor,
    })
    for (const {uri, value} of data.records) {
      const parsed = social.mu.live.event.$safeParse(value)
      if (!parsed.success) {
        logger.warn('live: event record failed validation', {uri})
        continue
      }
      events.push({...liveEventFromRecord(uri, parsed.value), fromRecord: true})
    }
    cursor = data.cursor
  } while (cursor)
  return events
}

/** The parts of a post record the Live section reads, loosely validated. */
const postRecordSchema = z.object({
  text: z.string().default(''),
  createdAt: z.string(),
  reply: z.unknown().optional(),
  embed: z
    .object({
      external: z
        .object({
          uri: z.string(),
          title: z.string().optional(),
          thumb: z.unknown().optional(),
        })
        .optional(),
    })
    .optional(),
  facets: z
    .array(
      z.object({
        features: z.array(z.object({uri: z.string().optional()})),
      }),
    )
    .optional(),
})

/** PDS endpoints by DID, so a refresh does not re-resolve every account. */
const pdsByDid = new Map<string, string>()

async function resolvePds(did: string): Promise<string | undefined> {
  const cached = pdsByDid.get(did)
  if (cached) return cached
  const pds = await resolveDidServiceEndpoint({
    did,
    id: '#atproto_pds',
    type: 'AtprotoPersonalDataServer',
  })
  if (pds) pdsByDid.set(did, pds)
  return pds
}

/**
 * Events implied by these accounts' own posts, a few accounts at a time.
 * Each account's latest posts (not replies) are read from its PDS, so a
 * post shows up the moment it is made, ahead of any appview indexing.
 */
async function listAccountPostEvents(dids: string[]): Promise<LiveEvent[]> {
  const events: LiveEvent[] = []
  for (const batch of chunk(dids, FEED_CONCURRENCY)) {
    const perAccount = await Promise.all(
      batch.map(did =>
        listOneAccountPostEvents(did).catch(() => {
          logger.warn("live: could not read an account's posts", {did})
          return [] as LiveEvent[]
        }),
      ),
    )
    events.push(...perAccount.flat())
  }
  return events
}

async function listOneAccountPostEvents(did: string): Promise<LiveEvent[]> {
  const pdsUrl = await resolvePds(did)
  if (!pdsUrl) return []
  const pds = createServiceClient(pdsUrl)
  const data = await pds.call(com.atproto.repo.listRecords, {
    repo: did as DidString,
    collection: 'app.bsky.feed.post',
    limit: POSTS_PER_SOURCE,
  })
  const events: LiveEvent[] = []
  for (const {uri, value} of data.records) {
    const parsed = postRecordSchema.safeParse(value)
    if (!parsed.success) {
      logger.warn('live: post record failed validation', {uri})
      continue
    }
    if (parsed.data.reply) continue
    const record = parsed.data
    const thumbCid = blobCid(record.embed?.external?.thumb)
    const event = liveEventFromPost({
      uri,
      authorDid: did,
      createdAt: record.createdAt,
      text: record.text,
      external: record.embed?.external
        ? {
            uri: record.embed.external.uri,
            title: record.embed.external.title,
            thumb: thumbCid
              ? `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${thumbCid}`
              : undefined,
          }
        : undefined,
      links: [
        record.embed?.external?.uri,
        ...(record.facets ?? []).flatMap(f => f.features.map(x => x.uri)),
      ].filter((u): u is string => !!u),
    })
    if (event) events.push(event)
  }
  return events
}

/**
 * The CID of a blob reference, whether it arrived as raw JSON
 * (`{ref: {$link}}`) or was processed by the lex client into a typed
 * reference (`{ref: CID}`).
 */
function blobCid(blob: unknown): string | undefined {
  if (!blob || typeof blob !== 'object' || !('ref' in blob)) return undefined
  const ref: unknown = blob.ref
  if (!ref || typeof ref !== 'object') return undefined
  if ('$link' in ref) {
    const link: unknown = ref.$link
    return typeof link === 'string' ? link : undefined
  }
  const toString = ref.toString
  if (typeof toString !== 'function') return undefined
  const str: unknown = toString.call(ref)
  return typeof str === 'string' && str !== '[object Object]' ? str : undefined
}

/* -------------------------------------------------------------------------
 * Editing
 * ---------------------------------------------------------------------- */

/** The editable fields of an event record, as plain strings. */
export type LiveEventInput = {
  title: string
  description?: string
  streamUrl: string
  host: string
  anchorPost?: string
  startsAt: string
  endsAt?: string
  image?: string
  accent?: string
  speakers?: string[]
  runningOrder?: {at: string; label: string}[]
}

/**
 * Creates or updates an event record in the signed-in account's repo. The
 * record is validated against the lexicon before it is written, since the
 * reader validates strictly and would otherwise drop a bad record silently.
 * Only meaningful for the curator account; the screens gate the editor on
 * {@link useIsLiveCurator}.
 */
export function useLiveEventMutation() {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  return useMutation({
    mutationFn: async ({
      rkey,
      record,
    }: {
      rkey?: string
      record: LiveEventInput
    }) => {
      if (!currentAccount) throw new Error('Not signed in')
      const key = rkey ?? TID.nextStr()
      const full = {
        $type: LIVE_EVENT_NSID,
        createdAt: new Date().toISOString(),
        ...record,
      }
      const check = social.mu.live.event.$safeParse(full)
      if (!check.success) {
        throw check.reason instanceof Error
          ? check.reason
          : new Error(String(check.reason))
      }
      await pdsClient.call(com.atproto.repo.putRecord, {
        repo: currentAccount.did,
        collection: LIVE_EVENT_NSID,
        rkey: key,
        validate: false,
        record: full,
      })
      return key
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['liveEvents']})
    },
  })
}

/* -------------------------------------------------------------------------
 * The anchor and the network view
 * ---------------------------------------------------------------------- */

export const createLiveAnchorQueryKey = (args: {
  id: string
  curatorDid?: string
}) => createQueryKey('liveAnchor', args)

/**
 * The post whose replies are the live thread. An explicit anchor on the
 * event wins; otherwise the host's own post of the stream link, then the
 * curator's, the way newsrooms find a publisher's canonical post. Waits
 * for the curator so the fallback is never skipped and cached as a miss.
 */
export function useLiveAnchorQuery(event: LiveEvent) {
  const client = useAppviewClient()
  const {data: curator} = useLiveCuratorQuery()
  const query = useQuery({
    queryKey: createLiveAnchorQueryKey({
      id: event.id,
      curatorDid: curator?.did,
    }),
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!event.anchorPostUri || !!curator,
    queryFn: async (): Promise<string | null> => {
      if (event.anchorPostUri) return event.anchorPostUri
      const key = streamKey(event.streamUrl)
      if (!key) return null
      const authors = [event.hostDid]
      if (curator && curator.did !== event.hostDid) authors.push(curator.did)
      for (const author of authors) {
        const pages = await Promise.all(
          streamUrlVariants(event.streamUrl).map(url =>
            client
              .call(app.bsky.feed.searchPosts, {
                q: url,
                url: url as UriString,
                author: author as DidString,
                sort: 'latest',
                limit: 25,
              })
              .then(data => data.posts)
              .catch(() => []),
          ),
        )
        const match = pages.flat().find(post => postReferencesStream(post, key))
        if (match) return match.uri
      }
      return null
    },
  })
  return {
    data: query.data ?? null,
    isLoading: query.isLoading || (!event.anchorPostUri && !curator),
  }
}

export const createLiveDiscussionQueryKey = (args: {id: string}) =>
  createQueryKey('liveDiscussion', args)

/**
 * Every post across the network that links the stream under any of its
 * URL forms, ranked by interactions. Callers drop the live thread's own
 * posts with {@link isInLiveThread}; keeping the anchor out of the key
 * means the anchor arriving costs no extra search.
 */
export function useLiveDiscussionQuery(event: LiveEvent) {
  const client = useAppviewClient()
  return useQuery({
    queryKey: createLiveDiscussionQueryKey({id: event.id}),
    staleTime: STALE.MINUTES.ONE,
    queryFn: async (): Promise<app.bsky.feed.defs.PostView[]> => {
      const key = streamKey(event.streamUrl)
      if (!key) return []
      const seen = new Map<string, app.bsky.feed.defs.PostView>()
      await Promise.all(
        streamUrlVariants(event.streamUrl).map(async url => {
          try {
            const data = await client.call(app.bsky.feed.searchPosts, {
              q: url,
              url: url as UriString,
              sort: 'top',
              limit: 25,
            })
            for (const post of data.posts) {
              if (!seen.has(post.uri) && postReferencesStream(post, key)) {
                seen.set(post.uri, post)
              }
            }
          } catch {
            /* One failing variant should not empty the view. */
          }
        }),
      )
      return Array.from(seen.values()).sort(
        (a, b) => engagementScore(b) - engagementScore(a),
      )
    },
  })
}

/** The anchor and any reply under it belong to the live thread, not here. */
export function isInLiveThread(
  post: app.bsky.feed.defs.PostView,
  anchorUri: string | null,
): boolean {
  if (!anchorUri) return false
  if (post.uri === anchorUri) return true
  if (!bsky.isType(app.bsky.feed.post, post.record)) return false
  return post.record.reply?.root?.uri === anchorUri
}
