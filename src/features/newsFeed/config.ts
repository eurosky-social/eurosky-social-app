import {IS_DUTCH_API_CONFIGURED} from '#/features/newsrooms/dutch/config'

/**
 * Whether the news hub (the news page shaped by interests, the newsroom
 * explore spread, the directory and the article page) replaces the original
 * news feed and newsroom pages.
 *
 * Opt-in per build with EXPO_PUBLIC_ENABLE_NEWS_V2=true, and only once the news
 * aggregator it reads is configured (see `newsrooms/dutch/config.ts`), so a
 * half-configured build keeps the original pages instead of a hub with nothing
 * to show. When off, the app serves the pages in `legacy/` and the hub's routes
 * resolve to Not Found.
 */
export const NEWS_V2_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_NEWS_V2 === 'true' && IS_DUTCH_API_CONFIGURED
