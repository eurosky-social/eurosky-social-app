import {useMemo, useSyncExternalStore} from 'react'
import {type QueryClient} from '@tanstack/react-query'

import {type TimedComment} from './moments'
import {momentsQueryKey, momentSummaryQueryKey} from './queryKeys'

/**
 * How long the app adds a comment it just posted to its video's moments. The
 * moments service has it a few seconds after posting, but its answers can be
 * 30 seconds (moments) or a minute (feed counts) old. Generous on purpose:
 * the comment is matched by its address, so it is never counted twice.
 */
export const POSTED_COMMENT_KEEP_MS = 5 * 60_000

type PostedComment = TimedComment & {videoPostUri: string}

let posted: readonly PostedComment[] = []
const listeners = new Set<() => void>()

function update(next: readonly PostedComment[]) {
  posted = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Remembers a comment linked to a second of a video that this app just
 * posted, so the video's moments show it straight away, and asks for the
 * video's moments again.
 */
export function rememberPostedComment(
  queryClient: QueryClient,
  comment: PostedComment,
) {
  update([...posted.filter(c => c.uri !== comment.uri), comment])
  setTimeout(() => forgetPostedComment(comment.uri), POSTED_COMMENT_KEEP_MS)
  void queryClient.invalidateQueries({
    queryKey: momentsQueryKey(comment.videoPostUri),
  })
  void queryClient.invalidateQueries({
    queryKey: momentSummaryQueryKey(comment.videoPostUri),
  })
}

/** Forgets a posted comment, for example because it was deleted. */
export function forgetPostedComment(uri: string) {
  if (!posted.some(c => c.uri === uri)) return
  update(posted.filter(c => c.uri !== uri))
}

function onVideo(
  comments: readonly PostedComment[],
  videoPostUri: string,
): TimedComment[] {
  return comments
    .filter(c => c.videoPostUri === videoPostUri)
    .map(({uri, seconds}) => ({uri, seconds}))
}

/** The comments this app recently posted on a video. */
export function postedCommentsOn(videoPostUri: string): TimedComment[] {
  return onVideo(posted, videoPostUri)
}

/** {@link postedCommentsOn}, updated when a comment is posted or forgotten. */
export function usePostedComments(videoPostUri: string): TimedComment[] {
  const all = useSyncExternalStore(subscribe, () => posted)
  return useMemo(() => onVideo(all, videoPostUri), [all, videoPostUri])
}
