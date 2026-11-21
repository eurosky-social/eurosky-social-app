import {type Agent} from '@atproto/lex'

import {
  getImageCdn,
  rewriteImageCdnUrlsInJson,
  SOURCE_IMAGE_CDN,
} from './config'
import {createImageCdnShadow} from './shadow'

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

const shadow = createImageCdnShadow()

/**
 * Wrap an agent so JSON responses carry image URLs on the selected CDN. Every
 * AppView returns Bluesky CDN URLs, so rewriting here covers all views without
 * touching each component that renders an image.
 */
export function withImageCdn(agent: Agent): Agent {
  return {
    get did() {
      return agent.did
    },
    async fetchHandler(path, init) {
      const response = await agent.fetchHandler(path, init)
      const cdn = getImageCdn()
      if (
        NULL_BODY_STATUSES.has(response.status) ||
        !response.headers.get('content-type')?.includes('application/json')
      ) {
        return response
      }
      if (cdn === SOURCE_IMAGE_CDN) {
        if (shadow?.sample()) {
          response
            .clone()
            .text()
            .then(shadow.copy, () => {})
        }
        return response
      }

      const body = rewriteImageCdnUrlsInJson(await response.text(), cdn)
      const headers = new Headers(response.headers)
      /* The body is already decoded and may have changed length. */
      headers.delete('content-length')
      headers.delete('content-encoding')
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    },
  }
}
