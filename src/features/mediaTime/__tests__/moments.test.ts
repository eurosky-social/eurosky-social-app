import {describe, expect, it} from '@jest/globals'

import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {
  collectTimedReplies,
  groupIntoMoments,
  mergeMoments,
  type Moment,
} from '../moments'
import {MEDIA_TIME_FIELD} from '../record'

const VIDEO_POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'

function comment(seconds: number, uri = `at://c/${seconds}`) {
  return {uri, seconds}
}

describe('groupIntoMoments', () => {
  it('returns no moments without comments', () => {
    expect(groupIntoMoments([])).toEqual([])
  })

  it('groups comments that are close together', () => {
    const moments = groupIntoMoments([
      comment(200),
      comment(10),
      comment(50),
      comment(25),
      comment(205),
      comment(400),
    ])
    expect(moments.map(m => [m.startSeconds, m.endSeconds, m.count])).toEqual([
      [10, 50, 3],
      [200, 205, 2],
      [400, 400, 1],
    ])
  })

  it('measures the gap from the previous comment, not the first', () => {
    const moments = groupIntoMoments([comment(0), comment(30), comment(60)])
    expect(moments).toHaveLength(1)
    expect(moments[0].endSeconds).toBe(60)
  })

  it('splits when the gap is larger than the limit', () => {
    expect(groupIntoMoments([comment(0), comment(31)])).toHaveLength(2)
    expect(groupIntoMoments([comment(0), comment(31)], 60)).toHaveLength(1)
  })

  it('orders comments at the same second by URI', () => {
    const [moment] = groupIntoMoments([
      comment(5, 'at://b'),
      comment(5, 'at://a'),
    ])
    expect(moment.comments.map(c => c.uri)).toEqual(['at://a', 'at://b'])
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
  const summary = (moments: Moment[]) =>
    moments.map(m => [m.startSeconds, m.endSeconds, m.count])

  it('keeps the server moments when it knows every local comment', () => {
    const server = [moment([comment(10), comment(20)])]
    expect(mergeMoments(server, [comment(20)])).toBe(server)
  })

  it('adds a comment the server does not know yet', () => {
    const server = [moment([comment(10), comment(20)]), moment([comment(300)])]
    expect(
      summary(mergeMoments(server, [comment(45, 'at://new'), comment(10)])),
    ).toEqual([
      [10, 45, 3],
      [300, 300, 1],
    ])
  })

  it('starts a new moment for a comment far from the others', () => {
    const server = [moment([comment(10)])]
    expect(summary(mergeMoments(server, [comment(500, 'at://new')]))).toEqual([
      [10, 10, 1],
      [500, 500, 1],
    ])
  })

  it('keeps the comments the server only counted', () => {
    // 150 comments from 0:10 to 0:40; the server listed the first 100
    const listed = Array.from({length: 100}, (_, i) =>
      comment(10 + (i % 20), `at://listed/${i}`),
    )
    const server = [{...moment(listed, 150), endSeconds: 40}]
    const merged = mergeMoments(server, [comment(65, 'at://new')])
    expect(summary(merged)).toEqual([[10, 65, 151]])
  })

  it('joins moments that the unlisted comments bring together', () => {
    const listed = Array.from({length: 100}, (_, i) =>
      comment(10, `at://listed/${i}`),
    )
    const server = [{...moment(listed, 120), endSeconds: 90}]
    expect(summary(mergeMoments(server, [comment(115, 'at://new')]))).toEqual([
      [10, 115, 121],
    ])
  })

  it('adds a comment to moments that are only counted, as in feeds', () => {
    const counted = (start: number, end: number, count: number) => ({
      startSeconds: start,
      endSeconds: end,
      count,
      comments: [],
    })
    const server = [counted(40, 50, 3), counted(200, 200, 1)]
    expect(summary(mergeMoments(server, [comment(45, 'at://new')]))).toEqual([
      [40, 50, 4],
      [200, 200, 1],
    ])
    expect(summary(mergeMoments(server, [comment(120, 'at://new')]))).toEqual([
      [40, 50, 3],
      [120, 120, 1],
      [200, 200, 1],
    ])
  })

  it('counts a comment it is given twice once', () => {
    const server = [moment([comment(10)])]
    const fresh = comment(20, 'at://new')
    expect(summary(mergeMoments(server, [fresh, fresh]))).toEqual([[10, 20, 2]])
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
