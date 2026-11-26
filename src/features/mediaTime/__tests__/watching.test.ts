import {describe, expect, it} from '@jest/globals'

import {isMoment} from '../moments'
import {
  busiestMoment,
  foldedMomentCount,
  momentStatuses,
  NOW_GRACE_SECONDS,
  playingMoment,
  timelineRows,
} from '../watching'

const at = (start: number, end: number, count = 1) => ({
  startSeconds: start,
  endSeconds: end,
  count,
  comments: [],
})

describe('momentStatuses', () => {
  const moments = [at(10, 20), at(60, 70), at(120, 130)]

  it('puts every moment ahead before the video plays', () => {
    expect(momentStatuses(moments, undefined)).toEqual([
      'ahead',
      'ahead',
      'ahead',
    ])
  })

  it('marks the moment playing, from its start until a little after its last comment', () => {
    expect(momentStatuses(moments, 60)).toEqual(['past', 'now', 'ahead'])
    expect(momentStatuses(moments, 70 + NOW_GRACE_SECONDS)).toEqual([
      'past',
      'now',
      'ahead',
    ])
    expect(momentStatuses(moments, 71 + NOW_GRACE_SECONDS)).toEqual([
      'past',
      'past',
      'ahead',
    ])
  })

  it('marks only the latest moment as playing when two would be', () => {
    expect(momentStatuses([at(10, 20), at(25, 40)], 28)).toEqual([
      'past',
      'now',
    ])
  })
})

describe('foldedMomentCount', () => {
  it('folds the past moments except the last two', () => {
    expect(foldedMomentCount(['past', 'past', 'past', 'now', 'ahead'])).toBe(1)
    expect(foldedMomentCount(['past', 'past', 'now'])).toBe(0)
    expect(foldedMomentCount(['ahead'])).toBe(0)
  })
})

describe('busiestMoment', () => {
  it('finds the moment with the most comments, the earlier one at a tie', () => {
    const moments = [at(10, 20, 3), at(60, 70, 9), at(120, 130, 9)]
    expect(busiestMoment(moments)).toBe(moments[1])
  })

  it('finds none for a single moment', () => {
    expect(busiestMoment([at(10, 20, 3)])).toBeUndefined()
  })
})

describe('isMoment', () => {
  it('takes three comments to make a moment', () => {
    expect(isMoment({count: 2})).toBe(false)
    expect(isMoment({count: 3})).toBe(true)
  })
})

describe('timelineRows', () => {
  const group = (seconds: number[], start = seconds[0]) => ({
    startSeconds: start,
    endSeconds: seconds[seconds.length - 1],
    count: seconds.length,
    comments: seconds.map(s => ({uri: `at://c/${s}`, seconds: s})),
  })
  const lone = group([12])
  const moment = group([40, 41, 45], 36)
  const pair = group([70, 73])

  it('shows groups too small to be moments as their comments, in order', () => {
    const rows = timelineRows([pair, lone, moment], undefined)
    expect(rows.map(r => [r.kind, r.seconds])).toEqual([
      ['comment', 12],
      ['moment', 36],
      ['comment', 70],
      ['comment', 73],
    ])
  })

  it('marks the first comment of a group one short of a moment', () => {
    const rows = timelineRows([lone, moment, pair], undefined)
    const forming = rows.map(r => (r.kind === 'comment' ? r.forming : null))
    expect(forming).toEqual([
      undefined,
      null,
      {count: 2, aroundSeconds: 72},
      undefined,
    ])
  })

  it('gives comments and moments one status line, with one playing', () => {
    expect(timelineRows([lone, moment, pair], 15).map(r => r.status)).toEqual([
      'now',
      'ahead',
      'ahead',
      'ahead',
    ])
    expect(timelineRows([lone, moment, pair], 44).map(r => r.status)).toEqual([
      'past',
      'now',
      'ahead',
      'ahead',
    ])
    expect(timelineRows([lone, moment, pair], 80).map(r => r.status)).toEqual([
      'past',
      'past',
      'past',
      'now',
    ])
  })

  it('skips groups whose comments are not listed', () => {
    const counted = {startSeconds: 90, endSeconds: 90, count: 1, comments: []}
    expect(timelineRows([counted], undefined)).toEqual([])
  })
})

describe('playingMoment', () => {
  const group = (start: number, end: number, count: number) => ({
    startSeconds: start,
    endSeconds: end,
    count,
    comments: [],
  })

  it('counts only groups big enough to be moments', () => {
    const lone = group(10, 10, 1)
    const moment = group(30, 40, 3)
    expect(playingMoment([lone, moment], 12)).toBeUndefined()
    expect(playingMoment([lone, moment], 35)).toBe(moment)
  })
})
