import {barAt, type Moment} from './moments'
import {formatMediaTime} from './record'

/*
 * A video's insights, for its author (design canvas "funk's view of the
 * episode"): how many comments it has and where, and the moments with
 * comments the author hasn't answered yet.
 */

/** How many bars the large strip has, as in the design canvas. */
export const INSIGHTS_STRIP_BARS = 64

/**
 * A video's comments: all direct replies (`replyCount` of the post), those
 * linked to a second of it, and those on the whole video. Never fewer in all
 * than linked, as the post's count and the moments service can disagree for
 * a moment.
 */
export function insightCounts(
  groups: readonly Pick<Moment, 'count'>[],
  replyCount: number | undefined,
): {total: number; linked: number; wholeVideo: number} {
  const linked = groups.reduce((sum, group) => sum + group.count, 0)
  const total = Math.max(replyCount ?? 0, linked)
  return {total, linked, wholeVideo: total - linked}
}

/**
 * The groups of comments with comments by others the author hasn't answered,
 * in order of time. Undefined when the moments service didn't say which
 * comments are answered (it didn't answer, or is older).
 */
export function waitingForAnswer(groups: Moment[]): Moment[] | undefined {
  if (groups.every(group => group.unansweredCount === undefined)) {
    return groups.length === 0 ? [] : undefined
  }
  return groups
    .filter(group => (group.unansweredCount ?? 0) > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds)
}

export type StripLabel = {
  /** Where along the strip, from 0 to 1: the middle of the moment's start bar. */
  at: number
  seconds: number
  text: string
}

/**
 * Times to write under the large strip: one per moment in `top` (the most
 * talked-about first), placed at its start. A label closer than `minGap`
 * (a share of the strip's width) to one of a bigger moment is left out, so
 * labels don't overlap. Sorted along the strip.
 */
export function stripLabels(
  top: readonly Pick<Moment, 'startSeconds'>[],
  duration: number | undefined,
  minGap: number,
  bars = INSIGHTS_STRIP_BARS,
): StripLabel[] {
  if (!duration || !(duration > 0)) return []
  const kept: StripLabel[] = []
  for (const moment of top) {
    const at = (barAt(moment.startSeconds, duration, bars) + 0.5) / bars
    if (kept.some(label => Math.abs(label.at - at) < minGap)) continue
    kept.push({
      at,
      seconds: moment.startSeconds,
      text: formatMediaTime(moment.startSeconds),
    })
  }
  return kept.sort((a, b) => a.at - b.at)
}
