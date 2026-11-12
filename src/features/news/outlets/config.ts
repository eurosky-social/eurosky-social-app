/**
 * Base URL of the publisher (`/api/newsrooms`), the service outlets sign up
 * to. Its newsrooms are the ones an operator listed for the app, and they make
 * up the featured outlets wherever the configured list runs short.
 *
 * Empty leaves the configured list as the only source.
 */
export const PUBLISHER_API_URL = withoutTrailingSlash(
  process.env.EXPO_PUBLIC_PUBLISHER_API_URL,
)

/**
 * The outlets featured first, in order: the news aggregator's slugs or the
 * outlets' DIDs, separated by commas or whitespace. One the aggregator does not
 * know is skipped, and the publisher's newsrooms make up the difference.
 */
export const FEATURED_OUTLET_REFS = parseRefs(
  process.env.EXPO_PUBLIC_FEATURED_OUTLETS,
)

/** How many featured outlets the news page shows. */
export const FEATURED_ON_NEWS_PAGE = 3

/** How many of each outlet's latest articles its card on the outlets tab lists. */
export const OUTLET_CARD_ARTICLES = 5

/** A configured base URL, with no trailing slash to double up with a path. */
function withoutTrailingSlash(value: string | undefined): string {
  return (value ?? '').replace(/\/+$/, '')
}

/** A configured list of refs, trimmed, without blanks or repeats. */
export function parseRefs(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(/[\s,]+/)
        .map(ref => ref.trim())
        .filter(Boolean),
    ),
  ]
}
