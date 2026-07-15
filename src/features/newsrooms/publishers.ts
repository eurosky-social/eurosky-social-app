/**
 * The registry of approved publishers. Each publisher owns a page at
 * `/newsroom/:didOrHandle` that blends its editorial posts, its reporters'
 * posts, and (later) external sources like RSS, podcasts, and YouTube.
 *
 * This is shared, operator-owned config rather than per-user state, so it lives
 * as a local list instead of in the PDS. There is no per-user newsroom state
 * for now: every registered newsroom is equally visible to everyone.
 */

/**
 * A content source feeding a publisher's page beyond its Bluesky account
 * (which is registry-level: `did` + `reporterDids`). Only RSS is consumed
 * today; podcast and YouTube adapters are roadmap and will extend this union
 * when they exist.
 */
export type NewsroomSource = {type: 'rss'; url: string}

export interface NewsroomPublisher {
  /** Stable id; may end up in per-user records later, so never reuse or renumber. */
  id: string
  displayName: string
  tagline: string
  /** The publisher's own Bluesky account; its posts are the editorial "desks". */
  did: string
  handle: string
  /** Per-publisher brand accent, tinting the follow button and share CTA. */
  accent?: string
  /** Category filter chips, e.g. Politics, World, Economy, Culture. */
  categories: string[]
  /** Accounts surfaced in the "From our reporters" rail / merged feed. */
  reporterDids: string[]
  /** Additional content sources beyond the publisher account. */
  sources: NewsroomSource[]
}

/**
 * Seed registry. Every entry is real: the reporter accounts are the outlet's
 * actual staff, sourced from the outlets' own starter packs and bio searches.
 */
export const NEWSROOM_PUBLISHERS: NewsroomPublisher[] = [
  {
    id: 'euobserver',
    displayName: 'EUobserver',
    tagline: 'EU news that matters.',
    did: 'did:plc:xnmkjaouspdzqv4hzvvcf3j3',
    handle: 'euobserver.com',
    // Sampled from the red-orange mark in their avatar.
    accent: '#EF513B',
    categories: ['EU', 'Politics', 'Green Economy', 'Migration', 'Digital'],
    reporterDids: [
      'did:plc:gswts63m3ew4kbrlwt7a5ika', // Elena Sánchez Nicolás, editor-in-chief
      'did:plc:rhcyq43xusgpcywquocnmudi', // Wester van Gaal, journalist
      'did:plc:2djedbaopsrmwlb7gcgx3wz6', // Nikolaj Nielsen, reporter
      'did:plc:epzn6awph6unnn6mhme2vn7o', // Alejandro Tauber, publisher
      'did:plc:fahhqa5u3xzw32dhdh4ahr5t', // Caroline de Gruyter, columnist
    ],
    sources: [{type: 'rss', url: 'https://euobserver.com/rss'}],
  },
  {
    id: 'the-guardian',
    displayName: 'The Guardian',
    tagline: 'Independent journalism since 1821.',
    did: 'did:plc:vovinwhtulbsx4mwfw26r5ni',
    handle: 'theguardian.com',
    accent: '#052962',
    categories: ['World', 'Europe', 'Politics', 'Culture'],
    reporterDids: [
      'did:plc:lyhmk2wj7ahzwfl6376h3pmz', // Jennifer Rankin, Brussels correspondent
      'did:plc:xsd2g766acjt2mozxstalj4u', // Jon Henley, Europe writer (Paris)
      'did:plc:vbt55fbjabjqu4do5tjcb374', // Kate Connolly, international correspondent (Berlin)
      'did:plc:ilphblz35zlpwrlgft7mdzms', // Ashifa Kassam, Europe communities correspondent
      'did:plc:ymmxjrydwu7z4nuujqvyqtfk', // Philip Oltermann, culture editor for Europe
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
    accent: '#D6212B',
    categories: ['EU', 'Politics', 'Policy', 'World'],
    // From the outlet's own "POLITICO Europe Newsroom" starter pack.
    reporterDids: [
      'did:plc:45otsfkxwkc5qzffhmpcqhzu', // Tim Ross, chief political correspondent
      'did:plc:w4bp23yrbkocr35h3rmm3thf', // Karl Mathiesen, senior correspondent (climate)
      'did:plc:adhdaaghrtlc75s3jzce4waw', // Antoaneta Roussi, cyber and intelligence
      'did:plc:kquml2hoj6p7qsw7ohlgfa5k', // Pieter Haeck, senior technology reporter
      'did:plc:e5ixzv36nmsa5brpxw5tqixg', // Camille Gijs, trade reporter
    ],
    sources: [{type: 'rss', url: 'https://www.politico.eu/feed/'}],
  },
  {
    id: '404-media',
    displayName: '404 Media',
    tagline: 'Unflinching reporting on the world of technology.',
    did: 'did:plc:vcepp6trx4vpe5ourxso4tjl',
    handle: '404media.co',
    accent: '#16A34A',
    categories: ['Technology', 'Privacy', 'Policy'],
    // The outlet's four founders.
    reporterDids: [
      'did:plc:cjfcz3t36f6nrprarkhkycxo', // Jason Koebler
      'did:plc:vk7rduhvom3rq6dyluce5wzf', // Joseph Cox
      'did:plc:pt47oe625rv5cnrkgvntwbiq', // Sam Cole
      'did:plc:fz7vvi4dlckgnon26xinmkch', // Emanuel Maiberg
    ],
    sources: [{type: 'rss', url: 'https://www.404media.co/rss/'}],
  },
]

/** The org focused by default on the `/newsroom` landing page (no did/handle). */
export function getDefaultNewsroomPublisher(): NewsroomPublisher {
  return NEWSROOM_PUBLISHERS[0]
}

/** Resolve a publisher from a route param that may be either a DID or a handle. */
export function getNewsroomPublisherByDidOrHandle(
  didOrHandle: string,
): NewsroomPublisher | undefined {
  return NEWSROOM_PUBLISHERS.find(
    p => p.did === didOrHandle || p.handle === didOrHandle,
  )
}

/**
 * The DIDs whose author feeds make up a publisher's merged page feed: the
 * publisher account plus its reporters, deduplicated.
 */
export function getPublisherFeedDids(publisher: NewsroomPublisher): string[] {
  return Array.from(new Set([publisher.did, ...publisher.reporterDids]))
}

/** The publisher's configured RSS/Atom feed URLs. */
export function getPublisherRssUrls(publisher: NewsroomPublisher): string[] {
  return publisher.sources
    .filter(source => source.type === 'rss')
    .map(source => source.url)
}
