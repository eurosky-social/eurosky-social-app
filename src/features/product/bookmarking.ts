import {AtUri} from '@atproto/syntax'

import {PRODUCT, type ProductConfig} from '#/config/product'
import {findPublisherByDid} from '#/features/publishers/publishers'

export class BookmarkingUnavailableError extends Error {
  constructor(message = 'Bookmarking is not available in this app') {
    super(message)
    this.name = 'BookmarkingUnavailableError'
  }
}

/** Reject before optimistic state changes as well as actual writes. */
export function assertBookmarkingEnabled(product: ProductConfig = PRODUCT) {
  if (!product.capabilities.bookmarking) throw new BookmarkingUnavailableError()
}

/** Canonical publisher DIDs, never a handle, caption, or quoted post's author. */
export function canBookmarkUri(uri: string, product: ProductConfig = PRODUCT) {
  if (!product.capabilities.bookmarking) return false
  if (product.id !== 'news') return true
  try {
    const parsed = new AtUri(uri)
    return (
      parsed.collection === 'app.bsky.feed.post' &&
      !!findPublisherByDid(parsed.host)
    )
  } catch {
    return false
  }
}

export function canBookmarkPost(
  post: {uri: string; author: {did: string}},
  product: ProductConfig = PRODUCT,
) {
  return (
    canBookmarkUri(post.uri, product) &&
    (product.id !== 'news' ||
      (new AtUri(post.uri).host === post.author.did &&
        !!findPublisherByDid(post.author.did)))
  )
}

export function assertCanBookmarkPost(
  post: {uri: string; author: {did: string}},
  product: ProductConfig = PRODUCT,
) {
  assertBookmarkingEnabled(product)
  if (!canBookmarkPost(post, product))
    throw new BookmarkingUnavailableError(
      'Only posts from news organisations can be saved in this app',
    )
}

export function assertCanBookmarkUri(
  uri: string,
  product: ProductConfig = PRODUCT,
) {
  assertBookmarkingEnabled(product)
  if (!canBookmarkUri(uri, product))
    throw new BookmarkingUnavailableError(
      'Only posts from news organisations can be saved in this app',
    )
}
