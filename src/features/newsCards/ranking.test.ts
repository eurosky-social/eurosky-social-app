import {type PostArticle} from '#/features/articles/articles'
import {rankStories, storyScore} from './ranking'

const NOW = new Date('2026-11-11T12:00:00Z')
const HOUR = 3_600_000

function story(
  id: string,
  {
    hoursAgo = 1,
    replies = 0,
    reposts = 0,
    likes = 0,
  }: {hoursAgo?: number; replies?: number; reposts?: number; likes?: number},
) {
  return {
    item: {
      uri: `at://did:plc:pub/app.bsky.feed.post/${id}`,
      record: {
        createdAt: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString(),
      },
      post: {replyCount: replies, repostCount: reposts, likeCount: likes},
    },
  } as unknown as PostArticle
}

it('weights replies double and decays with age', () => {
  expect(storyScore(story('a', {replies: 4, reposts: 2}), NOW)).toBeCloseTo(
    10 / 3 ** 1.5,
    6,
  )
})

it('scores stories older than 24 hours as zero', () => {
  expect(
    storyScore(story('old', {hoursAgo: 25, replies: 50, reposts: 50}), NOW),
  ).toBe(0)
})

it('ignores likes', () => {
  expect(storyScore(story('a', {likes: 900}), NOW)).toBe(0)
})

it('ranks by score, breaking ties with the newer story', () => {
  const older = story('older', {hoursAgo: 3})
  const newer = story('newer', {hoursAgo: 1})
  const hot = story('hot', {hoursAgo: 2, replies: 5})
  expect(
    rankStories([older, newer, hot], NOW).map(article => article.item.uri),
  ).toEqual([hot.item.uri, newer.item.uri, older.item.uri])
})

it('does not treat future-dated posts as fresh', () => {
  expect(storyScore(story('future', {hoursAgo: -5, replies: 9}), NOW)).toBe(0)
})
