import {describe, expect, it} from '@jest/globals'

import {
  busiestMoment,
  foldedMomentCount,
  momentStatuses,
  NOW_GRACE_SECONDS,
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
