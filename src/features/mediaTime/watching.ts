import {
  isMoment,
  MIN_MOMENT_COMMENTS,
  type Moment,
  type TimedComment,
} from './moments'

/** A moment still counts as playing this many seconds after its last comment. */
export const NOW_GRACE_SECONDS = 10
/** Past moments shown before the older ones fold into "N earlier moments". */
export const SHOWN_PAST_MOMENTS = 2

export type MomentStatus = 'past' | 'now' | 'ahead'

/**
 * Where each moment is relative to `playing`, the second being watched (the
 * start before the video plays): ahead of it, playing (from its start until
 * a little after its last comment; only the latest such moment), or past.
 * `moments` are sorted by start, as everywhere.
 */
export function momentStatuses(
  moments: readonly Pick<Moment, 'startSeconds' | 'endSeconds'>[],
  playing: number | undefined,
): MomentStatus[] {
  const at = playing ?? 0
  const statuses: MomentStatus[] = moments.map(moment =>
    at < moment.startSeconds
      ? 'ahead'
      : at <= moment.endSeconds + NOW_GRACE_SECONDS
        ? 'now'
        : 'past',
  )
  const lastNow = statuses.lastIndexOf('now')
  return statuses.map((status, i) =>
    status === 'now' && i !== lastNow ? 'past' : status,
  )
}

/**
 * How many moments, from the first, fold into "N earlier moments": the past
 * ones except the last `SHOWN_PAST_MOMENTS`.
 */
export function foldedMomentCount(statuses: readonly MomentStatus[]): number {
  const past = statuses.filter(status => status === 'past').length
  return Math.max(0, past - SHOWN_PAST_MOMENTS)
}

/**
 * The moment being played, counting only groups big enough to be moments
 * (`isMoment`), or `undefined`.
 */
export function playingMoment(
  groups: readonly Moment[],
  playing: number | undefined,
): Moment | undefined {
  const moments = groups.filter(isMoment)
  return moments[momentStatuses(moments, playing).indexOf('now')]
}

/** The moment with the most comments, if there is more than one moment. */
export function busiestMoment(moments: readonly Moment[]): Moment | undefined {
  if (moments.length < 2) return undefined
  return moments.reduce((busiest, moment) =>
    moment.count > busiest.count ? moment : busiest,
  )
}

/**
 * One row of the timeline: a moment, or a single comment of a group too
 * small to be a moment (`isMoment`).
 */
export type TimelineRow =
  | {
      kind: 'moment'
      key: string
      /** Where the row sits along the video: the moment's start. */
      seconds: number
      moment: Moment
      status: MomentStatus
    }
  | {
      kind: 'comment'
      key: string
      seconds: number
      comment: TimedComment
      status: MomentStatus
      /**
       * On the first comment of a group one comment short of a moment: how
       * many comments it has, and the second they're around.
       */
      forming?: {count: number; aroundSeconds: number}
    }

/**
 * The timeline's rows, sorted along the video: moments as moments, and the
 * comments of smaller groups one by one, all with one status line
 * (`momentStatuses`, so only one row plays at a time). Groups whose comments
 * aren't listed (counts only) are left out.
 */
export function timelineRows(
  groups: readonly Moment[],
  playing: number | undefined,
): TimelineRow[] {
  type Item =
    | Omit<Extract<TimelineRow, {kind: 'moment'}>, 'status'>
    | Omit<Extract<TimelineRow, {kind: 'comment'}>, 'status'>
  const items: (Item & {endSeconds: number})[] = []
  for (const group of groups) {
    if (isMoment(group)) {
      items.push({
        kind: 'moment',
        key: `moment-${group.startSeconds}`,
        seconds: group.startSeconds,
        endSeconds: group.endSeconds,
        moment: group,
      })
      continue
    }
    const comments = [...group.comments].sort((x, y) => x.seconds - y.seconds)
    const forming =
      group.count === MIN_MOMENT_COMMENTS - 1 && comments.length > 0
        ? {
            count: group.count,
            aroundSeconds: Math.round(
              comments.reduce((sum, c) => sum + c.seconds, 0) / comments.length,
            ),
          }
        : undefined
    comments.forEach((comment, i) => {
      items.push({
        kind: 'comment',
        key: `comment-${comment.uri}`,
        seconds: comment.seconds,
        endSeconds: comment.seconds,
        comment,
        forming: i === 0 ? forming : undefined,
      })
    })
  }
  items.sort((x, y) => x.seconds - y.seconds)
  const statuses = momentStatuses(
    items.map(item => ({
      startSeconds: item.seconds,
      endSeconds: item.endSeconds,
    })),
    playing,
  )
  return items.map(({endSeconds: _, ...item}, i) => ({
    ...item,
    status: statuses[i],
  }))
}
