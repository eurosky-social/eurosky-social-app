import {type AtUriString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {network} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from './config'
import {groupIntoMoments, isMoment, mergeMoments, type Moment} from './moments'
import {getMomentsClient} from './momentsClient'
import {usePostedComments} from './postedComments'
import {momentsQueryKey, momentSummaryQueryKey} from './queryKeys'
import {fetchMoments} from './useVideoMoments'

/** The service answers for at most this many posts per request. */
export const MAX_SUMMARY_URIS = 25
/** Requests made within this time are sent together. */
export const SUMMARY_BATCH_WAIT_MS = 50

type Waiting = {
  uri: string
  resolve: (moments: Moment[]) => void
  reject: (error: unknown) => void
}

let waiting: Waiting[] = []
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * The moments of a video post, without their comments (`comments` is
 * empty, `count` is set). Calls made close together, as when a feed page
 * renders several video posts, share one request.
 */
export function loadMomentSummary(uri: string): Promise<Moment[]> {
  return new Promise((resolve, reject) => {
    waiting.push({uri, resolve, reject})
    timer ??= setTimeout(() => void flush(), SUMMARY_BATCH_WAIT_MS)
  })
}

async function flush() {
  const batch = waiting
  waiting = []
  timer = undefined
  const uris = [...new Set(batch.map(w => w.uri))]
  for (let i = 0; i < uris.length; i += MAX_SUMMARY_URIS) {
    const chunk = uris.slice(i, i + MAX_SUMMARY_URIS)
    const inChunk = batch.filter(w => chunk.includes(w.uri))
    try {
      const res = await getMomentsClient().call(
        network.eurosky.feed.getMomentSummaries,
        {uris: chunk as AtUriString[]},
      )
      const byUri = new Map(
        res.summaries.map(summary => [
          summary.uri as string,
          summary.moments.map(moment => ({
            startSeconds: moment.startSeconds,
            endSeconds: moment.endSeconds,
            count: moment.replyCount,
            comments: [],
          })),
        ]),
      )
      for (const w of inChunk) w.resolve(byUri.get(w.uri) ?? [])
    } catch (error) {
      for (const w of inChunk) w.reject(error)
    }
  }
}

export const RQKEY = momentSummaryQueryKey

/**
 * Moments of a video post for a feed card. See {@link loadMomentSummary}.
 *
 * After this app posted a comment on the video, the counts would not show it
 * for up to a minute, and could not tell whether they include it. Then the
 * card asks for the video's full moments instead, which list each comment,
 * and adds the new one if they don't have it yet.
 */
export function useMomentSummary({
  postUri,
  enabled,
}: {
  postUri: string
  enabled: boolean
}): {data: Moment[] | undefined} {
  const posted = usePostedComments(postUri)
  const active = MEDIA_TIME_ENABLED && enabled
  const summary = useQuery({
    queryKey: RQKEY(postUri),
    enabled: active && posted.length === 0,
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryFn: () => loadMomentSummary(postUri),
  })
  const full = useQuery({
    queryKey: momentsQueryKey(postUri),
    enabled: active && posted.length > 0,
    staleTime: STALE.SECONDS.THIRTY,
    retry: false,
    queryFn: () => fetchMoments(postUri),
  })
  if (!active || posted.length === 0) return {data: summary.data}
  // Counts fetched before the comment was posted cannot include it.
  const base = full.data ?? summary.data
  return {data: base ? mergeMoments(base, posted) : groupIntoMoments(posted)}
}

/**
 * The moments with the most comments, most first; at equal counts the
 * earlier one first.
 */
export function topMoments(moments: Moment[], limit = 3): Moment[] {
  return moments
    .filter(isMoment)
    .sort((a, b) => b.count - a.count || a.startSeconds - b.startSeconds)
    .slice(0, limit)
}
