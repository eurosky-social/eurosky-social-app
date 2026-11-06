import {type FeedPostSlice} from '#/state/queries/post-feed'
import {articleFromPost, type PostArticle} from '#/features/articles/articles'
import {findPublisherByDid} from './publishers'

/** Preserve the API's round-robin order and the original post identities. */
export function articlesFromPublisherFeed(slices: readonly FeedPostSlice[]) {
  const seen = new Set<string>()
  const articles: PostArticle[] = []
  for (const slice of slices) {
    if (slice.reason) continue
    const item = slice.items.find(item => item.uri === slice.feedPostUri)
    if (
      !item ||
      item.record.reply ||
      !findPublisherByDid(item.post.author.did) ||
      seen.has(item.uri)
    )
      continue
    seen.add(item.uri)
    articles.push(articleFromPost(item))
  }
  return articles
}
