import {type InfiniteData} from '@tanstack/react-query'

import {PRODUCT, type ProductConfig} from '#/config/product'
import {canBookmarkPost, canBookmarkUri} from '#/features/product/bookmarking'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/** Filter the observer view, not the account's shared cache or stored bookmarks. Cursors stay intact. */
export function selectBookmarksForProduct(
  data: InfiniteData<app.bsky.bookmark.getBookmarks.$OutputBody>,
  product: ProductConfig = PRODUCT,
) {
  if (product.id !== 'news') return data
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      bookmarks: page.bookmarks.filter(bookmark => {
        if (!canBookmarkUri(bookmark.subject.uri, product)) return false
        if (bsky.isType(app.bsky.feed.defs.postView, bookmark.item))
          return canBookmarkPost(bookmark.item, product)
        return (
          bsky.isType(app.bsky.feed.defs.notFoundPost, bookmark.item) &&
          canBookmarkUri(bookmark.item.uri, product)
        )
      }),
    })),
  }
}
