import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'

import {type NewsroomPublisher} from '../publishers'
import {type RssItem} from '../rss/types'

/**
 * The explore page's shared sections. Publishers label their own articles in
 * their own vocabulary (`Companies`, `Tech`, `Wereld`, `Politique`), so the
 * page maps those labels onto one set of sections rather than showing every
 * outlet's taxonomy side by side.
 *
 * Labels are message descriptors rather than JSX because this is a data list;
 * screens render them through `i18n._`.
 */
export interface ExploreSection {
  id: string
  label: MessageDescriptor
  /**
   * Lowercase terms matched against an article's own category labels and its
   * URL path segments. Order within `EXPLORE_SECTIONS` decides ties, so the
   * narrower sections come first.
   */
  terms: string[]
}

export const EXPLORE_SECTIONS: ExploreSection[] = [
  {
    id: 'europe',
    label: msg`Europe`,
    terms: [
      'europe',
      'european',
      'european-union',
      'eu',
      'brussels',
      'euro',
      'eurozone',
    ],
  },
  {
    id: 'politics',
    label: msg`Politics`,
    terms: [
      'politics',
      'political',
      'policy',
      'government',
      'election',
      'elections',
      'parliament',
      'politique',
      'politiek',
      'justice',
      'law',
    ],
  },
  {
    id: 'business',
    label: msg`Business`,
    terms: [
      'business',
      'economy',
      'economics',
      'economia',
      'economie',
      'markets',
      'market',
      'finance',
      'financial',
      'money',
      'companies',
      'trade',
      'work',
    ],
  },
  {
    id: 'tech',
    label: msg`Technology`,
    terms: [
      'tech',
      'technology',
      'technologie',
      'digital',
      'ai',
      'artificial-intelligence',
      'internet',
      'cyber',
      'cybersecurity',
      'security',
      'privacy',
      'gadgets',
      'apps',
    ],
  },
  {
    id: 'climate',
    label: msg`Climate`,
    terms: [
      'climate',
      'environment',
      'energy',
      'sustainability',
      'green',
      'nature',
      'klimaat',
    ],
  },
  {
    id: 'science',
    label: msg`Science`,
    terms: [
      'science',
      'sciences',
      'space',
      'health',
      'medicine',
      'research',
      'wetenschap',
    ],
  },
  {
    id: 'culture',
    label: msg`Culture`,
    terms: [
      'culture',
      'cultura',
      'cultuur',
      'arts',
      'art',
      'entertainment',
      'film',
      'movies',
      'music',
      'books',
      'style',
      'life-arts',
      'tv',
      'games',
      'gaming',
    ],
  },
  {
    id: 'sport',
    label: msg`Sport`,
    terms: ['sport', 'sports', 'football', 'soccer', 'deportes'],
  },
  {
    id: 'investigations',
    label: msg`Investigations`,
    terms: ['investigation', 'investigations', 'investigative', 'exposed'],
  },
  {
    id: 'world',
    label: msg`World`,
    terms: [
      'world',
      'international',
      'global',
      'foreign',
      'wereld',
      'mundo',
      'monde',
      'us',
      'uk',
      'americas',
      'asia',
      'africa',
      'middle-east',
    ],
  },
]

/** Everything the section terms do not claim. Never dropped, just last. */
export const EXPLORE_SECTION_OTHER: ExploreSection = {
  id: 'other',
  label: msg`More stories`,
  terms: [],
}

/**
 * Which section an article belongs to, read from the strongest real signal
 * available: the publisher's own category labels for the item, then its URL
 * path (outlets encode the desk in the path - `/world/`, `/tech/`), then the
 * publisher's declared categories. Unmatched articles land in "More stories"
 * rather than being guessed at from their headline.
 */
export function sectionForArticle(
  item: RssItem,
  publisher: NewsroomPublisher,
): ExploreSection {
  return (
    matchSection(item.categories ?? []) ??
    matchSection(urlSegments(item.link)) ??
    matchSection(publisher.categories) ??
    EXPLORE_SECTION_OTHER
  )
}

/** The first section claiming any of `labels`, in `EXPLORE_SECTIONS` order. */
function matchSection(labels: string[]): ExploreSection | undefined {
  const terms = new Set(labels.flatMap(normalizeLabel))
  if (terms.size === 0) return undefined
  return EXPLORE_SECTIONS.find(section =>
    section.terms.some(term => terms.has(term)),
  )
}

/**
 * A label reduced to comparable terms: lowercased, split on the separators
 * outlets use (`Life & Arts`, `US politics`, `tech/ai`), and also kept whole so
 * hyphenated terms like `middle-east` still match.
 */
function normalizeLabel(label: string): string[] {
  const lower = label.toLowerCase().trim()
  const whole = lower.replace(/[\s_/]+/g, '-').replace(/[^a-z-]/g, '')
  const parts = lower.split(/[^a-z]+/i).filter(Boolean)
  return whole ? [whole, ...parts] : parts
}

/** The path segments of an article URL, e.g. `/2026/world/europe/x` . */
function urlSegments(url: string): string[] {
  try {
    return new URL(url).pathname.split('/').filter(Boolean)
  } catch {
    return []
  }
}
