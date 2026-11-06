import {PRODUCT, type ProductConfig} from '#/config/product'

/** Availability is independent of whether a disabled destination was placed in a menu. */
export function isProductRouteAvailable(
  name: string,
  product: ProductConfig = PRODUCT,
) {
  return (
    (product.capabilities.messaging || !name.startsWith('Messages')) &&
    (product.capabilities.bookmarking || name !== 'Bookmarks')
  )
}
