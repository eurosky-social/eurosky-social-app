import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {PRODUCT, type ProductConfig} from '#/config/product'
import {articleFromPost} from '#/features/articles/articles'
import {PUBLISHERS} from './publishers'

/** Change only original publisher posts in news, whether selected or an ancestor; replies and social threads stay upstream. */
export function publisherThreadArticle(
  item: Extract<ThreadItem, {type: 'threadPost'}>,
  product: ProductConfig = PRODUCT,
) {
  if (
    product.id !== 'news' ||
    item.depth > 0 ||
    item.value.post.record.reply ||
    !PUBLISHERS.some(publisher => publisher.did === item.value.post.author.did)
  )
    return undefined
  return articleFromPost({
    _reactKey: item.key,
    uri: item.value.post.uri,
    post: item.value.post,
    record: item.value.post.record,
    moderation: item.moderation,
  })
}
