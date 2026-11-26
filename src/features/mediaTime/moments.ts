import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {getMediaTime} from './record'

/*
 * Moments are where a video's comments pile up. Every comment adds a
 * bell-shaped bump to a curve along the video, and the moments are the hills
 * of that curve. The AppView groups the same way
 * (`network.eurosky.feed.getMoments`, blacksky-atproto
 * `packages/bsky/src/api/network/eurosky/feed/moments.ts`); keep the two
 * alike. The settings are first guesses, to be tuned with real comments.
 */

/** How wide one comment's bump is, in seconds (its standard deviation). */
export const MOMENT_BUMP_SECONDS = 10
/**
 * Two neighbouring hills are two moments only where the curve between them
 * dips at least this share below the lower of their tops.
 */
export const MOMENT_SPLIT_DIP = 0.3
/** A moment starts where its hill rises above this share of its height, */
export const MOMENT_RISE = 0.5
/** but at most this many seconds before its first comment. */
export const MOMENT_LEAD_SECONDS = 5
/** A bump counts as zero this many seconds from its comment. */
const BUMP_REACH_SECONDS = 4 * MOMENT_BUMP_SECONDS
/** A comment the server doesn't know yet joins a moment this close to it. */
export const MOMENT_JOIN_SECONDS = 2 * MOMENT_BUMP_SECONDS

export type TimedComment = {uri: string; seconds: number}

export type Moment = {
  /**
   * Where to start playing: just before the comments pile up. Can be after a
   * stray first comment.
   */
  startSeconds: number
  /** Second of the latest comment. */
  endSeconds: number
  /** How many comments the moment has; can be more than `comments` lists. */
  count: number
  comments: TimedComment[]
}

type Count = {seconds: number; count: number}

/** A moment's span and count, and the last second that belongs to it. */
type Found = {
  startSeconds: number
  endSeconds: number
  count: number
  until: number
}

const bySecond = (a: TimedComment, b: TimedComment) =>
  a.seconds - b.seconds || (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0)

/** Groups comments into moments, in order of time. */
export function groupIntoMoments(comments: TimedComment[]): Moment[] {
  const sorted = [...comments].sort(bySecond)
  const perSecond = new Map<number, number>()
  for (const {seconds} of sorted) {
    perSecond.set(seconds, (perSecond.get(seconds) ?? 0) + 1)
  }
  const found = findMoments(
    [...perSecond].map(([seconds, count]) => ({seconds, count})),
  )
  let next = 0
  return found.map(({startSeconds, endSeconds, count, until}) => {
    const listed: TimedComment[] = []
    while (next < sorted.length && sorted[next].seconds <= until) {
      listed.push(sorted[next])
      next++
    }
    return {startSeconds, endSeconds, count, comments: listed}
  })
}

function findMoments(counts: Count[]): Found[] {
  const sorted = counts
    .filter(c => c.count > 0)
    .sort((a, b) => a.seconds - b.seconds)
  // Bumps of comments further apart than this never touch, so each stretch
  // of nearby comments gets a curve of its own.
  const found: Found[] = []
  let from = 0
  for (let i = 1; i <= sorted.length; i++) {
    if (
      i === sorted.length ||
      sorted[i].seconds - sorted[i - 1].seconds > 2 * BUMP_REACH_SECONDS
    ) {
      found.push(...hillsOf(sorted.slice(from, i)))
      from = i
    }
  }
  return found
}

/** The moments of a stretch of comments, sorted by second, none empty. */
function hillsOf(counts: Count[]): Found[] {
  const first = counts[0].seconds
  const last = counts[counts.length - 1].seconds
  const lo = Math.max(0, first - BUMP_REACH_SECONDS)
  const curve = new Float64Array(last + BUMP_REACH_SECONDS - lo + 1)
  const spread = 2 * MOMENT_BUMP_SECONDS ** 2
  for (const {seconds, count} of counts) {
    const to = seconds + BUMP_REACH_SECONDS
    for (let t = Math.max(lo, seconds - BUMP_REACH_SECONDS); t <= to; t++) {
      curve[t - lo] += count * Math.exp(-((t - seconds) ** 2) / spread)
    }
  }

  // The tops of the hills (the first of equal neighbours), and the lowest
  // point between each two neighbouring tops. Indexes into `curve`.
  const tops: number[] = []
  for (let i = 0; i < curve.length; i++) {
    const left = i > 0 ? curve[i - 1] : -Infinity
    const right = i < curve.length - 1 ? curve[i + 1] : -Infinity
    if (curve[i] > left && curve[i] >= right) tops.push(i)
  }
  const dips: number[] = []
  for (let k = 0; k + 1 < tops.length; k++) {
    let low = tops[k]
    for (let i = tops[k]; i <= tops[k + 1]; i++) {
      if (curve[i] < curve[low]) low = i
    }
    dips.push(low)
  }

  // Join neighbouring hills across dips that are too shallow, the
  // shallowest first; the joined hill keeps the higher top.
  for (;;) {
    let join = -1
    let joinRatio = 1 - MOMENT_SPLIT_DIP
    for (let k = 0; k < dips.length; k++) {
      const lowerTop = Math.min(curve[tops[k]], curve[tops[k + 1]])
      const ratio = curve[dips[k]] / lowerTop
      if (ratio > joinRatio) {
        join = k
        joinRatio = ratio
      }
    }
    if (join < 0) break
    const higher =
      curve[tops[join]] >= curve[tops[join + 1]] ? tops[join] : tops[join + 1]
    tops.splice(join, 2, higher)
    dips.splice(join, 1)
  }

  // Each second belongs to the hill between the dips around it.
  const found: Found[] = []
  let next = 0
  tops.forEach((top, k) => {
    const until = k < dips.length ? dips[k] + lo : last
    let count = 0
    let firstSecond = -1
    let lastSecond = -1
    while (next < counts.length && counts[next].seconds <= until) {
      if (firstSecond < 0) firstSecond = counts[next].seconds
      lastSecond = counts[next].seconds
      count += counts[next].count
      next++
    }
    if (count === 0) return
    const leftEdge = k > 0 ? dips[k - 1] : 0
    let rise = top
    while (rise > leftEdge && curve[rise - 1] >= MOMENT_RISE * curve[top]) {
      rise--
    }
    const start = Math.max(0, rise + lo, firstSecond - MOMENT_LEAD_SECONDS)
    found.push({
      startSeconds: Math.min(start, lastSecond),
      endSeconds: lastSecond,
      count,
      until,
    })
  })
  return found
}

/** `comments` without repeats of the same comment, first one kept. */
export function uniqueComments(comments: TimedComment[]): TimedComment[] {
  const seen = new Set<string>()
  return comments.filter(c => !seen.has(c.uri) && seen.add(c.uri))
}

/**
 * Adds comments the server did not know yet (a reply just posted, or one the
 * server's index missed) to the server's moments, without moving the
 * server's borders: a comment joins the nearest moment within
 * `MOMENT_JOIN_SECONDS` of it, and the others form moments of their own. The
 * server lists at most 100 comments per moment, and feed counts list none;
 * a moment keeps counting the comments it doesn't list.
 */
export function mergeMoments(
  server: Moment[],
  local: TimedComment[],
): Moment[] {
  const known = new Set(server.flatMap(m => m.comments.map(c => c.uri)))
  const extra = uniqueComments(local).filter(c => !known.has(c.uri))
  if (extra.length === 0) return server

  const merged = server.map(m => ({...m, comments: [...m.comments]}))
  const alone: TimedComment[] = []
  for (const comment of extra) {
    const target = nearestMoment(merged, comment.seconds)
    if (!target) {
      alone.push(comment)
      continue
    }
    target.count += 1
    target.comments.push(comment)
    target.comments.sort(bySecond)
    if (comment.seconds < target.startSeconds) {
      target.startSeconds = Math.max(0, comment.seconds - MOMENT_LEAD_SECONDS)
    }
    target.endSeconds = Math.max(target.endSeconds, comment.seconds)
  }
  return [...merged, ...groupIntoMoments(alone)].sort(
    (a, b) => a.startSeconds - b.startSeconds,
  )
}

/**
 * The bar of `count` bars along a video of `duration` seconds that
 * `seconds` falls in.
 */
export function barAt(seconds: number, duration: number, count: number) {
  return Math.min(
    count - 1,
    Math.max(0, Math.floor((seconds / duration) * count)),
  )
}

/**
 * How many comments fall in each of `count` bars along a video of
 * `duration` seconds: each moment's count is spread evenly over the bars
 * its span covers. All zero while the length is unknown.
 */
export function momentBars(
  moments: Moment[],
  duration: number,
  count: number,
): number[] {
  const bars: number[] = Array.from({length: count}, () => 0)
  if (!(duration > 0)) return bars
  for (const moment of moments) {
    const first = barAt(moment.startSeconds, duration, count)
    const last = barAt(moment.endSeconds, duration, count)
    const share = moment.count / (last - first + 1)
    for (let i = first; i <= last; i++) bars[i] += share
  }
  return bars
}

/**
 * The moment at `seconds`: the one whose span holds it, else the nearest
 * within `MOMENT_JOIN_SECONDS`. Moments move a little as comments come in,
 * so a link to a moment names a second, not the moment itself.
 */
export function momentAt(
  moments: Moment[],
  seconds: number,
): Moment | undefined {
  return nearestMoment(moments, seconds)
}

/**
 * The second a new comment links to: the second being watched, or
 * `fallbackSeconds` before the video has played. Added to a moment
 * (`within`), it stays inside the moment's span, so a comment written after
 * the video played on still lands in that moment.
 */
export function commentSecond({
  playing,
  fallbackSeconds,
  within,
}: {
  playing: number | undefined
  fallbackSeconds: number
  within?: Pick<Moment, 'startSeconds' | 'endSeconds'>
}): number {
  const watched =
    playing !== undefined && playing > 0 ? playing : fallbackSeconds
  if (!within) return watched
  return Math.min(Math.max(watched, within.startSeconds), within.endSeconds)
}

function nearestMoment(moments: Moment[], seconds: number): Moment | undefined {
  let nearest: Moment | undefined
  let nearestDistance = Infinity
  for (const moment of moments) {
    const distance = Math.max(
      0,
      moment.startSeconds - seconds,
      seconds - moment.endSeconds,
    )
    if (distance <= MOMENT_JOIN_SECONDS && distance < nearestDistance) {
      nearest = moment
      nearestDistance = distance
    }
  }
  return nearest
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
