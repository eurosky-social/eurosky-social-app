import {PRODUCT, type ProductConfig} from '#/config/product'

/** A client policy failure, not an authentication or chat-service error. */
export class MessagingUnavailableError extends Error {
  constructor() {
    super('Messaging is not available in this app')
    this.name = 'MessagingUnavailableError'
  }
}

/** Account deletion remains an independent privacy action, not messaging access. */
export function isMessagingRequestAllowed(
  path: string,
  product: ProductConfig = PRODUCT,
) {
  const pathname = new URL(path, 'https://product.invalid').pathname
  return (
    product.capabilities.messaging ||
    !pathname.startsWith('/xrpc/chat.bsky.') ||
    pathname === '/xrpc/chat.bsky.actor.deleteAccount'
  )
}

export function assertMessagingEnabled(product: ProductConfig = PRODUCT) {
  if (!product.capabilities.messaging) throw new MessagingUnavailableError()
}

/** Compatibility for existing route-policy callers. */
export {isProductRouteAvailable} from './routes'
