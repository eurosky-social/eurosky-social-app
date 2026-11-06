import {PRODUCT, type ProductConfig} from '#/config/product'

export class BookmarkingUnavailableError extends Error {
  constructor() {
    super('Bookmarking is not available in this app')
    this.name = 'BookmarkingUnavailableError'
  }
}

/** Reject before optimistic state changes as well as actual writes. */
export function assertBookmarkingEnabled(product: ProductConfig = PRODUCT) {
  if (!product.capabilities.bookmarking) throw new BookmarkingUnavailableError()
}
