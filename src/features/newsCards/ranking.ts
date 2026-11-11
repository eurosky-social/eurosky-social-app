import {type PostArticle} from '#/features/articles/articles'

const HOUR = 3_600_000
/** Stories older than this do not compete for Top stories or Popular. */
const WINDOW_HOURS = 24
/** Hacker News-style gravity: higher values favour fresh stories more. */
const GRAVITY = 1.5
/** Keeps a brand-new story with one reply from jumping straight to the top. */
const AGE_OFFSET_HOURS = 2

function postedAt(article: PostArticle) {
  return new Date(article.item.record.createdAt).getTime()
}

/**
 * Replies count double because they signal conversation, not just
 * amplification; likes are ignored. The age decay lets fresh, active stories
 * rise instead of the oldest big story always winning.
 */
export function storyScore(article: PostArticle, now: Date) {
  const hours = (now.getTime() - postedAt(article)) / HOUR
  /* Future-dated posts are not trusted to stay fresh. */
  if (!Number.isFinite(hours) || hours < 0 || hours > WINDOW_HOURS) return 0
  const {replyCount = 0, repostCount = 0} = article.item.post
  const engagement = 2 * replyCount + repostCount
  return engagement / Math.pow(hours + AGE_OFFSET_HOURS, GRAVITY)
}

/** Highest score first; equal scores put the newer story first. */
export function rankStories(articles: readonly PostArticle[], now: Date) {
  return articles
    .map(article => ({article, score: storyScore(article, now)}))
    .sort(
      (x, y) => y.score - x.score || postedAt(y.article) - postedAt(x.article),
    )
    .map(({article}) => article)
}
