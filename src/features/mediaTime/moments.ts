import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {getMediaTime} from './record'

/**
 * Comments closer together than this (in seconds of the video) belong to the
 * same moment. A first guess, to be tuned with real data. The AppView groups
 * with the same gap (`network.eurosky.feed.getMoments`).
 */
export const MOMENT_GAP_SECONDS = 30

export type TimedComment = {uri: string; seconds: number}

export type Moment = {
  /** Second of the earliest comment; jumping to the moment starts here. */
  startSeconds: number
  /** Second of the latest comment. */
  endSeconds: number
  /** How many comments the moment has; can be more than `comments` lists. */
  count: number
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
      current.count += 1
      current.endSeconds = comment.seconds
    } else {
      moments.push({
        startSeconds: comment.seconds,
        endSeconds: comment.seconds,
        count: 1,
        comments: [comment],
      })
    }
  }
  return moments
}

/**
 * Adds comments the server did not know yet (a reply just posted, or one the
 * server's index missed) to the server's moments. The server lists at most
 * 100 comments per moment; the ones it only counted stay counted, with the
 * moment's start, so no comment is counted twice.
 */
export function mergeMoments(
  server: Moment[],
  local: TimedComment[],
  gapSeconds = MOMENT_GAP_SECONDS,
): Moment[] {
  const known = new Set(server.flatMap(m => m.comments.map(c => c.uri)))
  const extra = local.filter(c => !known.has(c.uri))
  if (extra.length === 0) return server

  const merged = groupIntoMoments(
    [...server.flatMap(m => m.comments), ...extra],
    gapSeconds,
  )
  for (const moment of server) {
    const unlisted = moment.count - moment.comments.length
    if (unlisted <= 0) continue
    const target = merged.find(
      m =>
        m.startSeconds <= moment.startSeconds &&
        moment.startSeconds <= m.endSeconds,
    )
    if (!target) continue
    target.count += unlisted
    target.endSeconds = Math.max(target.endSeconds, moment.endSeconds)
  }
  // A moment that grew to its unlisted comments' end can now reach the next.
  const joined: Moment[] = []
  for (const moment of merged) {
    const previous = joined.at(-1)
    if (previous && moment.startSeconds - previous.endSeconds <= gapSeconds) {
      previous.endSeconds = Math.max(previous.endSeconds, moment.endSeconds)
      previous.count += moment.count
      previous.comments.push(...moment.comments)
    } else {
      joined.push(moment)
    }
  }
  return joined
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
