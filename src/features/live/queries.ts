import {TID} from '@atproto/common-web'
import {type UriString} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
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
  getStreamPlayer,
  LIVE_CURATOR_HANDLE,
  LIVE_EVENT_NSID,
  type LiveEvent,
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
 * Events
 * ---------------------------------------------------------------------- */

export const createLiveEventsQueryKey = (args: {curatorDid?: string}) =>
  createQueryKey('liveEvents', args)

/**
 * The programme: every `social.mu.live.event` record in the curator's repo,
 * plus an event for each curator post that links a playable stream. Both
 * are read from the PDS, so a change shows up without waiting for an
 * appview. Keyed by stream, so a record for a stream the curator already
 * posted supersedes the post-derived event and keeps its id as an alias.
 */
export function useLiveEventsQuery() {
  const {data: curator} = useLiveCuratorQuery()
  return useQuery({
    queryKey: createLiveEventsQueryKey({curatorDid: curator?.did}),
    staleTime: STALE.MINUTES.ONE,
    refetchInterval: STALE.MINUTES.FIVE,
    enabled: !!curator,
    queryFn: async (): Promise<LiveEvent[]> => {
      const pds = createServiceClient(curator!.pds)
      const [records, fromPosts] = await Promise.all([
        listEventRecords(pds, curator!),
        listPostEvents(pds, curator!),
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
        // Records win over posts; among posts the first (newest) wins.
        const winner = existing.fromRecord ? existing : event
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
      for (const event of fromPosts) place(event)

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
  const events = useLiveEventsQuery()
  const data = id
    ? (events.data?.find(
        event => event.id === id || event.aliasIds?.includes(id),
      ) ?? null)
    : null
  return {
    data,
    isLoading: curator.isLoading || events.isLoading,
    error: curator.error ?? events.error,
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

/** How many recent curator posts to scan for stream links. */
const POST_SCAN_LIMIT = 50

/**
 * A post carries no end time, so a post-derived event counts as live for
 * this long after it was posted, then moves to "Recent". A record sets its
 * own times.
 */
const POST_EVENT_DURATION_MS = 12 * 60 * 60 * 1000

/**
 * Events implied by the curator's own posts: the latest posts (not replies)
 * whose link plays inline. The post is the anchor, its link-card title the
 * event title, its text the description.
 */
async function listPostEvents(
  pds: ReturnType<typeof createServiceClient>,
  curator: LiveCurator,
): Promise<LiveEvent[]> {
  const data = await pds.call(com.atproto.repo.listRecords, {
    repo: curator.did as DidString,
    collection: 'app.bsky.feed.post',
    limit: POST_SCAN_LIMIT,
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
    const candidates = [
      record.embed?.external?.uri,
      ...(record.facets ?? []).flatMap(f => f.features.map(x => x.uri)),
    ].filter((u): u is string => !!u)
    const streamUrl = candidates.find(u => !!getStreamPlayer(u))
    if (!streamUrl) continue

    const external =
      record.embed?.external?.uri === streamUrl
        ? record.embed.external
        : undefined
    // Drop the link itself, including the shortened form the composer writes.
    const text = record.text
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\bwww\.\S+/gi, '')
      .trim()
    const firstLine = text.split('\n')[0]?.trim()
    const title = external?.title?.trim() || firstLine || streamUrl
    const thumbCid = blobCid(external?.thumb)
    const image =
      thumbCid && !streamKey(streamUrl)?.startsWith('youtube:')
        ? `${curator.pds}/xrpc/com.atproto.sync.getBlob?did=${curator.did}&cid=${thumbCid}`
        : undefined
    const rkey = uri.split('/').pop() ?? uri
    const startsAt = record.createdAt
    const endsAt = new Date(
      new Date(startsAt).getTime() + POST_EVENT_DURATION_MS,
    ).toISOString()

    events.push({
      id: rkey,
      uri,
      title,
      description: title === firstLine ? undefined : text || undefined,
      hostDid: curator.did,
      streamUrl,
      anchorPostUri: uri,
      startsAt,
      endsAt,
      image,
    })
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
