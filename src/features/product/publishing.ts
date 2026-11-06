import {PRODUCT, type ProductConfig} from '#/config/product'

/** Structural input shared by composer options and the actual submission. */
type PublishingAction = {
  replyTo?: unknown
  quote?: unknown
  editPost?: unknown
}

/**
 * Editing is independent from creation. Quotes are checked before replies so
 * attaching a quote to a reply cannot bypass the product's quote policy.
 */
export function canOpenComposer(
  action: PublishingAction,
  product: ProductConfig = PRODUCT,
): boolean {
  if (action.editPost) return true
  return canCreatePost(
    {replyTo: action.replyTo, hasQuote: !!action.quote},
    product,
  )
}

/** Check the current content, not just the mode the composer opened with. */
export function canCreatePost(
  {replyTo, hasQuote}: {replyTo?: unknown; hasQuote: boolean},
  product: ProductConfig = PRODUCT,
): boolean {
  return (
    (!hasQuote || product.capabilities.quotePosting) &&
    (!!replyTo || product.capabilities.standalonePosting)
  )
}
