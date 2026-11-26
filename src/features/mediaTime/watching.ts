import {type Moment} from './moments'

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
  moments: readonly Moment[],
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

/** The moment with the most comments, if there is more than one moment. */
export function busiestMoment(moments: readonly Moment[]): Moment | undefined {
  if (moments.length < 2) return undefined
  return moments.reduce((busiest, moment) =>
    moment.count > busiest.count ? moment : busiest,
  )
}
