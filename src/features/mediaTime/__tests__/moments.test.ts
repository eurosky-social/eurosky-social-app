import {describe, expect, it} from '@jest/globals'

import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {
  barAt,
  collectTimedReplies,
  commentSecond,
  groupIntoMoments,
  highlightedBars,
  mergeMoments,
  type Moment,
  momentAt,
  momentBars,
} from '../moments'
import {MEDIA_TIME_FIELD} from '../record'

const VIDEO_POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'

function comment(seconds: number, uri = `at://c/${seconds}`) {
  return {uri, seconds}
}

// The same cases and values as the AppView's tests
// (blacksky-atproto packages/bsky/tests/eurosky/media-time-moments.test.ts).
describe('groupIntoMoments', () => {
  let n = 0
  const spans = (seconds: number[]) =>
    groupIntoMoments(seconds.map(s => comment(s, `at://c/${n++}`))).map(m => [
      m.startSeconds,
      m.endSeconds,
      m.count,
    ])
  // two busy spots 38 seconds apart, with two comments between them
  const twoSpots = [
    60, 61, 62, 63, 64, 65, 66, 66, 80, 85, 98, 99, 100, 101, 102, 103, 104,
    104,
  ]

  it('returns no moments without comments', () => {
    expect(groupIntoMoments([])).toEqual([])
  })

  it("starts a comment's moment 5 seconds before it, and not before 0", () => {
    expect(spans([41])).toEqual([[36, 41, 1]])
    expect(spans([2])).toEqual([[0, 2, 1]])
  })

  it('keeps two busy spots apart when a few comments lie between them', () => {
    // a 30-second gap between comments would have made this one moment
    expect(spans(twoSpots)).toEqual([
      [55, 80, 9],
      [82, 104, 9],
    ])
  })

  it('keeps a long, even stretch of comments as one moment', () => {
    const everyThreeSeconds = Array.from({length: 31}, (_, i) => 120 + 3 * i)
    expect(spans(everyThreeSeconds)).toEqual([[119, 210, 31]])
  })

  it('starts where comments pile up, not at a stray earlier comment', () => {
    expect(
      spans([100, 125, 125, 126, 126, 126, 127, 127, 128, 128, 128]),
    ).toEqual([[115, 128, 11]])
  })

  it('keeps comments far apart in separate moments', () => {
    expect(spans([200, 0])).toEqual([
      [0, 0, 1],
      [195, 200, 1],
    ])
  })

  it('lists every comment once, by second, then by URI', () => {
    const moments = groupIntoMoments([
      comment(5, 'at://b'),
      comment(5, 'at://a'),
      comment(300, 'at://c'),
    ])
    expect(moments.map(m => m.comments.map(c => c.uri))).toEqual([
      ['at://a', 'at://b'],
      ['at://c'],
    ])
  })
})

describe('mergeMoments', () => {
  function moment(comments: {uri: string; seconds: number}[], count?: number) {
    const seconds = comments.map(c => c.seconds)
    return {
      startSeconds: Math.min(...seconds),
      endSeconds: Math.max(...seconds),
      count: count ?? comments.length,
      comments,
    } satisfies Moment
  }
  const counted = (start: number, end: number, count: number) => ({
    startSeconds: start,
    endSeconds: end,
    count,
    comments: [],
  })
  const summary = (moments: Moment[]) =>
    moments.map(m => [m.startSeconds, m.endSeconds, m.count])

  it('keeps the server moments when it knows every local comment', () => {
    const server = [moment([comment(10), comment(20)])]
    expect(mergeMoments(server, [comment(20)])).toBe(server)
  })

  it('adds a comment the server does not know yet to the nearest moment', () => {
    const server = [moment([comment(10), comment(20)]), moment([comment(300)])]
    expect(
      summary(mergeMoments(server, [comment(35, 'at://new'), comment(10)])),
    ).toEqual([
      [10, 35, 3],
      [300, 300, 1],
    ])
  })

  it("leaves the server's borders where they are", () => {
    const server = [counted(36, 60, 9), counted(80, 104, 9)]
    // 6 seconds after the first moment, 14 before the second
    expect(summary(mergeMoments(server, [comment(66, 'at://new')]))).toEqual([
      [36, 66, 10],
      [80, 104, 9],
    ])
  })

  it('moves a moment back for a comment just before it', () => {
    const server = [counted(36, 41, 1)]
    expect(summary(mergeMoments(server, [comment(30, 'at://new')]))).toEqual([
      [25, 41, 2],
    ])
  })

  it('starts moments of their own for comments far from the others', () => {
    const server = [moment([comment(10)])]
    expect(
      summary(
        mergeMoments(server, [
          comment(500, 'at://new/1'),
          comment(502, 'at://new/2'),
        ]),
      ),
    ).toEqual([
      [10, 10, 1],
      [495, 502, 2],
    ])
  })

  it('keeps the comments the server only counted', () => {
    // 150 comments from 0:10 to 0:40; the server listed the first 100
    const listed = Array.from({length: 100}, (_, i) =>
      comment(10 + (i % 20), `at://listed/${i}`),
    )
    const server = [{...moment(listed, 150), endSeconds: 40}]
    const merged = mergeMoments(server, [comment(55, 'at://new')])
    expect(summary(merged)).toEqual([[10, 55, 151]])
    expect(merged[0].comments).toHaveLength(101)
  })

  it('adds a comment to moments that are only counted, as in feeds', () => {
    const server = [counted(40, 50, 3), counted(200, 200, 1)]
    expect(summary(mergeMoments(server, [comment(45, 'at://new')]))).toEqual([
      [40, 50, 4],
      [200, 200, 1],
    ])
    expect(summary(mergeMoments(server, [comment(120, 'at://new')]))).toEqual([
      [40, 50, 3],
      [115, 120, 1],
      [200, 200, 1],
    ])
  })

  it('counts a comment it is given twice once', () => {
    const server = [moment([comment(10)])]
    const fresh = comment(20, 'at://new')
    expect(summary(mergeMoments(server, [fresh, fresh]))).toEqual([[10, 20, 2]])
  })

  it('does not change the moments it was given', () => {
    const server = [moment([comment(10)])]
    mergeMoments(server, [comment(20, 'at://new')])
    expect(summary(server)).toEqual([[10, 10, 1]])
    expect(server[0].comments).toHaveLength(1)
  })
})

describe('momentAt', () => {
  const at = (start: number, end: number) => ({
    startSeconds: start,
    endSeconds: end,
    count: 1,
    comments: [],
  })
  const moments = [at(36, 60), at(80, 104), at(300, 300)]

  it('finds the moment that holds the second', () => {
    expect(momentAt(moments, 36)).toBe(moments[0])
    expect(momentAt(moments, 90)).toBe(moments[1])
  })

  it('or the nearest within 20 seconds, as moments shift a little', () => {
    expect(momentAt(moments, 65)).toBe(moments[0])
    expect(momentAt(moments, 75)).toBe(moments[1])
    expect(momentAt(moments, 320)).toBe(moments[2])
  })

  it('finds none far from every moment', () => {
    expect(momentAt(moments, 200)).toBeUndefined()
    expect(momentAt([], 10)).toBeUndefined()
  })
})

describe('commentSecond', () => {
  const moment: Moment = {
    startSeconds: 12,
    endSeconds: 18,
    count: 3,
    comments: [comment(14), comment(15), comment(18)],
  }

  it('uses the second being watched', () => {
    expect(commentSecond({playing: 40, fallbackSeconds: 12})).toBe(40)
  })

  it('uses the fallback before the video has played', () => {
    expect(commentSecond({playing: undefined, fallbackSeconds: 12})).toBe(12)
    expect(commentSecond({playing: 0, fallbackSeconds: 12})).toBe(12)
  })

  it('keeps the second being watched inside the moment', () => {
    expect(
      commentSecond({playing: 15, fallbackSeconds: 12, within: moment}),
    ).toBe(15)
  })

  it('stops at the end of the moment once the video has played past it', () => {
    expect(
      commentSecond({playing: 45, fallbackSeconds: 12, within: moment}),
    ).toBe(18)
  })

  it('starts at the start of the moment when the video is before it', () => {
    expect(
      commentSecond({playing: 3, fallbackSeconds: 12, within: moment}),
    ).toBe(12)
  })
})

describe('collectTimedReplies', () => {
  function postItem(
    uri: string,
    record: Record<string, unknown>,
    depth = 1,
  ): ThreadItem {
    return {
      type: 'threadPost',
      key: uri,
      uri,
      depth,
      value: {post: {uri, record}},
    } as unknown as ThreadItem
  }
  const timed = (seconds: number) => ({
    [MEDIA_TIME_FIELD]: {$type: MEDIA_TIME_FIELD, seconds},
  })
  const replyTo = (uri: string) => ({reply: {parent: {uri}, root: {uri}}})

  it('keeps direct replies to the video post that carry a time', () => {
    const items = [
      postItem(VIDEO_POST, {text: 'the video'}, 0),
      postItem('at://r/1', {...replyTo(VIDEO_POST), ...timed(41)}),
      postItem('at://r/2', {...replyTo(VIDEO_POST)}),
      postItem('at://r/3', {...replyTo('at://r/1'), ...timed(99)}, 2),
      postItem('at://r/4', {...replyTo(VIDEO_POST), ...timed(-5)}),
      {type: 'readMore', key: 'more'} as unknown as ThreadItem,
    ]
    expect(collectTimedReplies(items, VIDEO_POST)).toEqual([
      {uri: 'at://r/1', seconds: 41},
    ])
  })
})

describe('momentBars', () => {
  const at = (start: number, end: number, count: number) => ({
    startSeconds: start,
    endSeconds: end,
    count,
    comments: [],
  })

  it('finds the bar a second falls in, keeping the end inside', () => {
    expect(barAt(0, 100, 10)).toBe(0)
    expect(barAt(55, 100, 10)).toBe(5)
    expect(barAt(100, 100, 10)).toBe(9)
  })

  it("spreads each moment's comments over the bars it covers", () => {
    expect(momentBars([at(0, 5, 2), at(40, 59, 6)], 100, 10)).toEqual([
      2, 0, 0, 0, 3, 3, 0, 0, 0, 0,
    ])
  })

  it('is all zero while the length is unknown', () => {
    expect(momentBars([at(0, 5, 2)], 0, 4)).toEqual([0, 0, 0, 0])
  })
})

describe('highlightedBars', () => {
  const span = (start: number, end: number) => ({
    startSeconds: start,
    endSeconds: end,
    count: 3,
    comments: [],
  })

  it('marks the bars a moment covers', () => {
    // 10 bars of 10 seconds each
    expect(highlightedBars([span(25, 41)], 100, 10)).toEqual([
      false,
      false,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('marks nothing while the length is unknown', () => {
    expect(highlightedBars([span(25, 41)], 0, 3)).toEqual([false, false, false])
  })
})
