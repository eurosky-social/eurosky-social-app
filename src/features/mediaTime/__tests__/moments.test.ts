import {describe, expect, it} from '@jest/globals'

import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {collectTimedReplies, groupIntoMoments} from '../moments'
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
    expect(
      moments.map(m => [m.startSeconds, m.endSeconds, m.comments.length]),
    ).toEqual([
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
