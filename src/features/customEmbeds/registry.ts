import {
  createExternalEmbedRegistry,
  type ExternalEmbedView,
} from '@social-app-community/embed-kit'

import {logger} from '#/logger'
import {atmoRsvpHandler} from '#/features/customEmbeds/atmoRsvp'
import {tangledStringHandler} from '#/features/customEmbeds/tangledString'

/**
 * Ordered compile-time registry for app-owned and community embed handlers.
 * The first match wins; matcher failures are isolated by embed-kit so the app
 * can fall back to its normal external card.
 */
const registry = createExternalEmbedRegistry(
  [atmoRsvpHandler, tangledStringHandler],
  {
    onMatchError(error, handler, candidate) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        handlerId: handler.id,
        uri: candidate.view.uri,
      })
    },
  },
)

export function matchCustomEmbed(view: ExternalEmbedView) {
  return registry.match(view, 'post')
}

export function matchCustomEmbedPreview(view: ExternalEmbedView) {
  return registry.matchPreview(view)
}
