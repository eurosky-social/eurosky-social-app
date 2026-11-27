import {describe, expect, it} from '@jest/globals'

import {insightCounts, stripLabels, waitingForAnswer} from '../insights'
import {type Moment} from '../moments'

const group = (
  startSeconds: number,
  count: number,
  unansweredCount?: number,
): Moment => ({
  startSeconds,
  endSeconds: startSeconds + 5,
  count,
  comments: [],
  ...(unansweredCount !== undefined ? {unansweredCount} : {}),
})

describe('insightCounts', () => {
  it('splits all comments into linked ones and ones on the whole video', () => {
    expect(insightCounts([group(10, 3), group(90, 1)], 12)).toEqual({
      total: 12,
      linked: 4,
      wholeVideo: 8,
    })
  })

  it('never counts fewer comments in all than linked ones', () => {
    // the post's count lags behind, or the post wasn't loaded
    expect(insightCounts([group(10, 3)], 2)).toEqual({
      total: 3,
      linked: 3,
      wholeVideo: 0,
    })
    expect(insightCounts([group(10, 3)], undefined).total).toBe(3)
  })
})

describe('waitingForAnswer', () => {
  it('lists groups with unanswered comments, in order of time', () => {
    const late = group(300, 4, 2)
    const early = group(20, 1, 1)
    expect(waitingForAnswer([late, group(100, 5, 0), early])).toEqual([
      early,
      late,
    ])
  })

  it("leaves out groups the service didn't count", () => {
    // e.g. a group formed from a comment the service didn't know yet
    expect(waitingForAnswer([group(20, 3, 1), group(400, 1)])).toEqual([
      group(20, 3, 1),
    ])
  })

  it("is unknown when the service doesn't say", () => {
    expect(waitingForAnswer([group(20, 3), group(90, 1)])).toBeUndefined()
  })

  it('is empty without comments', () => {
    expect(waitingForAnswer([])).toEqual([])
  })
})

describe('stripLabels', () => {
  it('writes the start of each top moment where it is along the strip', () => {
    // a 640-second video in 64 bars: 10 seconds a bar
    expect(stripLabels([group(125, 9), group(40, 6)], 640, 0.1)).toEqual([
      {at: 4.5 / 64, seconds: 40, text: '0:40'},
      {at: 12.5 / 64, seconds: 125, text: '2:05'},
    ])
  })

  it('leaves out a label too close to that of a bigger moment', () => {
    expect(
      stripLabels([group(300, 9), group(320, 6), group(600, 3)], 640, 0.1).map(
        label => label.seconds,
      ),
    ).toEqual([300, 600])
  })

  it('has none until the length is known', () => {
    expect(stripLabels([group(40, 6)], undefined, 0.1)).toEqual([])
    expect(stripLabels([group(40, 6)], 0, 0.1)).toEqual([])
  })
})
