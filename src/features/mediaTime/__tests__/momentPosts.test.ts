import {type AtUriString} from '@atproto/syntax'
import {type ModerationOpts} from '@bsky/sdk/moderation'
import {describe, expect, it, jest} from '@jest/globals'

import {type app} from '#/lexicons'
import {
  fetchMomentPosts,
  MISSING_POSTS_RETRIES,
  MISSING_POSTS_RETRY_MS,
  missingPostsRetryInterval,
  POSTS_PER_REQUEST,
  sortMomentPosts,
  visibleMomentPosts,
} from '../momentPosts'

type PostView = app.bsky.feed.defs.PostView

const VIEWER = 'did:plc:viewer'
const uri = (n: number) => `at://did:plc:a${n}/app.bsky.feed.post/${n}`

function post(
  n: number,
  {
    likes = 0,
    replies = 0,
    indexedAt = '2026-11-25T12:00:00.000Z',
    muted = false,
  }: {
    likes?: number
    replies?: number
    indexedAt?: string
    muted?: boolean
  } = {},
): PostView {
  return {
    uri: uri(n),
    cid: `bafy${n}`,
    author: {
      did: `did:plc:a${n}`,
      handle: `a${n}.test`,
      viewer: {muted},
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: `comment ${n}`,
      createdAt: indexedAt,
    },
    likeCount: likes,
    replyCount: replies,
    indexedAt,
    labels: [],
  } as unknown as PostView
}

const MODERATION_OPTS: ModerationOpts = {
  userDid: VIEWER,
  prefs: {
    adultContentEnabled: false,
    labels: {},
    labelers: [],
    mutedWords: [],
    hiddenPosts: [],
  },
  labelDefs: {},
}

describe('fetchMomentPosts', () => {
  it('asks for at most 25 posts at a time and returns all of them', async () => {
    const uris = Array.from({length: 60}, (_, i) => uri(i))
    const getPosts = jest.fn((chunk: AtUriString[]) =>
      Promise.resolve(chunk.map((_, i) => post(i))),
    )
    const posts = await fetchMomentPosts(uris, getPosts)
    expect(getPosts.mock.calls.map(([chunk]) => chunk.length)).toEqual([
      POSTS_PER_REQUEST,
      POSTS_PER_REQUEST,
      10,
    ])
    expect(posts).toHaveLength(60)
  })

  it('asks nothing for no comments', async () => {
    const getPosts = jest.fn((_chunk: AtUriString[]) => Promise.resolve([]))
    expect(await fetchMomentPosts([], getPosts)).toEqual([])
    expect(getPosts).not.toHaveBeenCalled()
  })
})

describe('missingPostsRetryInterval', () => {
  const uris = [uri(1), uri(2)]

  it('asks again while a comment is missing, a few times', () => {
    expect(missingPostsRetryInterval([post(1)], uris, 1)).toBe(
      MISSING_POSTS_RETRY_MS,
    )
    expect(
      missingPostsRetryInterval([post(1)], uris, MISSING_POSTS_RETRIES + 1),
    ).toBe(false)
  })

  it('stops once every comment is there, or before any answer', () => {
    expect(missingPostsRetryInterval([post(2), post(1)], uris, 1)).toBe(false)
    expect(missingPostsRetryInterval(undefined, uris, 0)).toBe(false)
  })
})

describe('sortMomentPosts', () => {
  const old = post(1, {likes: 5, indexedAt: '2026-11-25T10:00:00.000Z'})
  const newer = post(2, {likes: 5, indexedAt: '2026-11-25T11:00:00.000Z'})
  const discussed = post(3, {
    likes: 5,
    replies: 4,
    indexedAt: '2026-11-25T09:00:00.000Z',
  })
  const liked = post(4, {likes: 9, indexedAt: '2026-11-25T08:00:00.000Z'})
  const newest = post(5, {indexedAt: '2026-11-25T12:00:00.000Z'})
  const all = [old, newer, discussed, liked, newest]
  const order = (posts: PostView[]) => posts.map(p => p.uri)

  it('puts the most liked first, then the most replied to, then the oldest', () => {
    expect(order(sortMomentPosts(all, 'top'))).toEqual(
      order([liked, discussed, old, newer, newest]),
    )
  })

  it('or the newest first', () => {
    expect(order(sortMomentPosts(all, 'newest'))).toEqual(
      order([newest, newer, old, discussed, liked]),
    )
  })

  it('leaves the list it was given alone', () => {
    const given = [old, liked]
    sortMomentPosts(given, 'top')
    expect(order(given)).toEqual(order([old, liked]))
  })
})

describe('visibleMomentPosts', () => {
  it("leaves out comments the video's author hid", () => {
    const visible = visibleMomentPosts(
      [post(1), post(2)],
      new Set([uri(2)]),
      MODERATION_OPTS,
    )
    expect(visible.map(p => p.uri)).toEqual([uri(1)])
  })

  it('leaves out comments by muted accounts', () => {
    const visible = visibleMomentPosts(
      [post(1), post(2, {muted: true})],
      new Set(),
      MODERATION_OPTS,
    )
    expect(visible.map(p => p.uri)).toEqual([uri(1)])
  })
})
