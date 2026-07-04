/**
 * The curated registry of approved publishers. Each publisher owns a page at
 * `/newsroom/:didOrHandle` that blends its editorial posts, its reporters'
 * posts, and (later) external sources like RSS, podcasts, and YouTube.
 *
 * This is shared, operator-owned config rather than per-user state, so it lives
 * as a local list instead of in the PDS. The reader's own opt-in selections
 * live in the `social.mu.curatedPagesPrefs` record (see ./state/prefs), exactly
 * as the news feed splits its source registry from `social.mu.newsFeedPrefs`.
 */

/**
 * A content source feeding a publisher's page. Only the Bluesky variants are
 * consumed in P0; the rest are declared now so the registry shape is stable and
 * later phases add adapters without changing the type or the page.
 */
export type CuratedSource =
  | {type: 'bluesky-author'; did: string}
  | {type: 'bluesky-feed'; uri: string}
  | {type: 'rss'; url: string} // P2
  | {type: 'podcast'; url: string} // P4
  | {type: 'youtube'; channelId: string} // P4

export interface CuratedPublisher {
  /** Stable id stored in the reader's prefs record. Never reuse or renumber. */
  id: string
  displayName: string
  tagline: string
  /** The publisher's own Bluesky account; its posts are the editorial "desks". */
  did: string
  handle: string
  /** The "Approved publisher" tier shown in the masthead. */
  approved: boolean
  /** Optional per-publisher accent tint for the masthead. */
  accent?: string
  /** Category filter chips, e.g. Politics, World, Economy, Culture. */
  categories: string[]
  /** Accounts surfaced in the "From our reporters" rail / merged feed. */
  reporterDids: string[]
  /** Additional content sources beyond the publisher account. */
  sources: CuratedSource[]
}

/**
 * Seed registry. The DIDs below are real network accounts borrowed as
 * placeholders so the page populates out of the box - swap them for the actual
 * publisher and its reporters before shipping.
 */
export const CURATED_PUBLISHERS: CuratedPublisher[] = [
  {
    id: 'the-guardian',
    displayName: 'The Guardian',
    tagline: 'Independent journalism since 1821.',
    did: 'did:plc:vovinwhtulbsx4mwfw26r5ni',
    handle: 'theguardian.com',
    approved: true,
    accent: '#052962',
    categories: ['World', 'Europe', 'Politics', 'Culture'],
    // TODO: replace with the outlet's real reporter accounts.
    reporterDids: [
      'did:plc:6xofcnvvojjnmggqx43zghwh', // spiegel.de
      'did:plc:ffccycfh6c6pmxwkhvq5clkv', // afp.com
    ],
    sources: [
      {type: 'rss', url: 'https://www.theguardian.com/world/europe-news/rss'},
    ],
  },
  {
    id: 'politico-europe',
    displayName: 'POLITICO Europe',
    tagline: 'The politics of the European Union, decoded.',
    did: 'did:plc:bak7f4b3jsiqlpyo6o4ejaji',
    handle: 'politico.eu',
    approved: true,
    accent: '#D6212B',
    categories: ['EU', 'Politics', 'Policy', 'World'],
    // TODO: replace with the outlet's real reporter accounts.
    reporterDids: [
      'did:plc:vovinwhtulbsx4mwfw26r5ni', // theguardian.com
      'did:plc:6xofcnvvojjnmggqx43zghwh', // spiegel.de
    ],
    sources: [{type: 'rss', url: 'https://www.politico.eu/feed/'}],
  },
  {
    id: '404-media',
    displayName: '404 Media',
    tagline: 'Unflinching reporting on the world of technology.',
    did: 'did:plc:vcepp6trx4vpe5ourxso4tjl',
    handle: '404media.co',
    approved: true,
    accent: '#16A34A',
    categories: ['Technology', 'Privacy', 'Policy'],
    // TODO: replace with the outlet's real reporter accounts.
    reporterDids: [
      'did:plc:ffccycfh6c6pmxwkhvq5clkv', // afp.com
      'did:plc:6xofcnvvojjnmggqx43zghwh', // spiegel.de
    ],
    sources: [{type: 'rss', url: 'https://www.404media.co/rss/'}],
  },
]

/** The org focused by default on the `/newsroom` landing page (no did/handle). */
export function getDefaultCuratedPublisher(): CuratedPublisher {
  return CURATED_PUBLISHERS[0]
}

export function getCuratedPublisherById(
  id: string,
): CuratedPublisher | undefined {
  return CURATED_PUBLISHERS.find(p => p.id === id)
}

/** Resolve a publisher from a route param that may be either a DID or a handle. */
export function getCuratedPublisherByDidOrHandle(
  didOrHandle: string,
): CuratedPublisher | undefined {
  return CURATED_PUBLISHERS.find(
    p => p.did === didOrHandle || p.handle === didOrHandle,
  )
}

/**
 * The DIDs whose author feeds make up a publisher's merged page feed: the
 * publisher account plus its reporters, deduplicated.
 */
export function getPublisherFeedDids(publisher: CuratedPublisher): string[] {
  return Array.from(new Set([publisher.did, ...publisher.reporterDids]))
}

/** The publisher's configured RSS/Atom feed URLs. */
export function getPublisherRssUrls(publisher: CuratedPublisher): string[] {
  return publisher.sources
    .filter(source => source.type === 'rss')
    .map(source => source.url)
}
