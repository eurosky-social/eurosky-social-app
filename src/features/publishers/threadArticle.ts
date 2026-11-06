import {type FeedPostSliceItem} from '#/state/queries/post-feed'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {PRODUCT, type ProductConfig} from '#/config/product'
import {articleFromPost} from '#/features/articles/articles'
import {PUBLISHERS} from './publishers'

/** Change only original publisher posts in news, whether selected or an ancestor; replies and social threads stay upstream. */
export function publisherThreadArticle(
  item: Extract<ThreadItem, {type: 'threadPost'}>,
  product: ProductConfig = PRODUCT,
) {
  if (item.depth > 0) return undefined
  return publisherPostArticle(
    {
      _reactKey: item.key,
      uri: item.value.post.uri,
      post: item.value.post,
      record: item.value.post.record,
      moderation: item.moderation,
    },
    product,
  )
}

/** Profile reply context uses the same publisher body, not a second social external card. */
export function publisherFeedArticle(
  item: FeedPostSliceItem,
  feedDescriptor?: string,
  product: ProductConfig = PRODUCT,
) {
  if (!feedDescriptor?.startsWith('publisher-replies|')) return undefined
  return publisherPostArticle(item, product)
}

function publisherPostArticle(item: FeedPostSliceItem, product: ProductConfig) {
  if (
    product.id !== 'news' ||
    item.record.reply ||
    !PUBLISHERS.some(publisher => publisher.did === item.post.author.did)
  )
    return undefined
  return articleFromPost(item)
}
