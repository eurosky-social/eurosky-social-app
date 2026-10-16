import {IS_WEB} from '#/env'

/** Default origin of the local dev proxy (`node services/rss/dev-proxy.mjs`). */
const DEV_PROXY_URL = 'http://localhost:8788'

/**
 * Many news feeds send no CORS headers, so a web build cannot fetch them
 * directly. Point EXPO_PUBLIC_RSS_PROXY_URL at a passthrough that adds CORS
 * (see services/rss/) for web; native can fetch feeds directly, so the proxy is
 * optional there. In a local web dev build we fall back to the dev proxy origin
 * so the front page works without extra env setup.
 */
export const RSS_PROXY_URL =
  process.env.EXPO_PUBLIC_RSS_PROXY_URL ||
  (__DEV__ && IS_WEB ? DEV_PROXY_URL : '')

/** Wrap a feed URL in the proxy when one is configured, else fetch it direct. */
export function buildRssFetchUrl(feedUrl: string): string {
  return RSS_PROXY_URL
    ? `${RSS_PROXY_URL}?url=${encodeURIComponent(feedUrl)}`
    : feedUrl
}
