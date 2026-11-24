import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {getMediaTime} from './record'

/**
 * Comments closer together than this (in seconds of the video) belong to the
 * same moment. A first guess, to be tuned with real data.
 */
export const MOMENT_GAP_SECONDS = 30

export type TimedComment = {uri: string; seconds: number}

export type Moment = {
  /** Second of the earliest comment; jumping to the moment starts here. */
  startSeconds: number
  /** Second of the latest comment. */
  endSeconds: number
  comments: TimedComment[]
}

/**
 * Groups comments into moments: sorted by second, a comment starts a new
 * moment when it is more than `gapSeconds` after the previous one.
 */
export function groupIntoMoments(
  comments: TimedComment[],
  gapSeconds = MOMENT_GAP_SECONDS,
): Moment[] {
  const sorted = [...comments].sort(
    (a, b) => a.seconds - b.seconds || a.uri.localeCompare(b.uri),
  )
  const moments: Moment[] = []
  for (const comment of sorted) {
    const current = moments.at(-1)
    if (current && comment.seconds - current.endSeconds <= gapSeconds) {
      current.comments.push(comment)
      current.endSeconds = comment.seconds
    } else {
      moments.push({
        startSeconds: comment.seconds,
        endSeconds: comment.seconds,
        comments: [comment],
      })
    }
  }
  return moments
}

/**
 * Direct replies to `videoPostUri` that are linked to a second. Deeper
 * replies belong to their parent's moment and carry no time of their own.
 */
export function collectTimedReplies(
  items: readonly ThreadItem[],
  videoPostUri: string,
): TimedComment[] {
  const comments: TimedComment[] = []
  for (const item of items) {
    if (item.type !== 'threadPost') continue
    const post = item.value.post
    if (post.record.reply?.parent?.uri !== videoPostUri) continue
    const seconds = getMediaTime(post.record)
    if (seconds === undefined) continue
    comments.push({uri: post.uri, seconds})
  }
  return comments
}
