import {type NewsroomPublisher} from '../publishers'
import {type RssItem} from '../rss/types'
import {
  EXPLORE_SECTION_OTHER,
  type ExploreSection,
  sectionForArticle,
} from './sections'

/**
 * The outlet that ran an article, as the spread's cards read it.
 *
 * Narrower than `NewsroomPublisher` (which satisfies it structurally) because
 * not every source of a story is a registered publisher: a labeler-backed
 * spread ingests outlets by feed alone, most with no Bluesky account, so `did`
 * cannot be assumed.
 */
export interface ExploreOutlet {
  /** Stable per outlet; the registry id, or the site host for a bare feed. */
  id: string
  /** Present only with a Bluesky account: drives the avatar and the byline link. */
  did?: string
  /** Fallback display name, for an outlet with no profile to read one from. */
  name?: string
  /** Section hints for an article carrying no labels of its own. */
  categories: string[]
}

/** One article, kept with the outlet that ran it. */
export interface ExploreArticle {
  publisher: ExploreOutlet
  item: RssItem
  section: ExploreSection
}

/**
 * The live profile behind an outlet, where it has one. Outlets without an
 * account never match a profile, so this keeps that check in one place rather
 * than at every avatar.
 */
export function outletProfile<T>(
  profiles: Map<string, T>,
  outlet: ExploreOutlet,
): T | undefined {
  return outlet.did ? profiles.get(outlet.did) : undefined
}

/**
 * A story as the explore page shows it: one lead article plus every other
 * newsroom's version of the same event.
 */
export interface ExploreStory {
  /** The lead article's URL; stable across renders of the same feed data. */
  id: string
  lead: ExploreArticle
  /** The lead first, then the other outlets covering the story. */
  coverage: ExploreArticle[]
  /** Distinct newsrooms in `coverage`; the page's ranking signal. */
  newsroomCount: number
  section: ExploreSection
  publishedAt?: string
}

/** Shared headline words below which two articles are never the same story. */
const MIN_SHARED_TERMS = 2

/** Dice coefficient over headline terms, above which two articles cluster. */
const MIN_SIMILARITY = 0.4

/**
 * Groups a set of articles into stories, so an event several newsrooms covered
 * reads once rather than once per outlet.
 *
 * Matching is a headline heuristic: two articles are the same story when their
 * significant headline words overlap enough (`MIN_SHARED_TERMS` shared terms and
 * a Dice coefficient over `MIN_SIMILARITY`). It is deliberately conservative -
 * a missed match costs a duplicate row, a false match hides one outlet's story
 * under another's headline. An explicit signal (a shared Atmosphere thread, or
 * a story identifier a publisher writes) can replace it later without changing
 * the page.
 *
 * Articles arrive grouped by publisher; the result is sorted by how many
 * newsrooms cover each story, then by recency.
 */
export function clusterArticles(
  articlesByPublisher: {publisher: NewsroomPublisher; articles: RssItem[]}[],
): ExploreStory[] {
  const articles: ExploreArticle[] = articlesByPublisher.flatMap(
    ({publisher, articles: items}) =>
      items.map(item => ({
        publisher,
        item,
        section: sectionForArticle(item, publisher),
      })),
  )

  // Newest first, so the article that broke the story leads its cluster.
  const ordered = [...articles].sort(
    (a, b) => publishedTime(b.item) - publishedTime(a.item),
  )

  const clusters: {members: ExploreArticle[]; terms: Set<string>[]}[] = []
  for (const article of ordered) {
    const terms = headlineTerms(article.item.title)
    const match = clusters.find(
      cluster =>
        // Same-outlet articles are separate stories: an outlet running two
        // pieces on one event is coverage, not duplication.
        !cluster.members.some(m => m.publisher.id === article.publisher.id) &&
        cluster.terms.some(other => isSameStory(terms, other)),
    )
    if (match) {
      match.members.push(article)
      match.terms.push(terms)
    } else {
      clusters.push({members: [article], terms: [terms]})
    }
  }

  return clusters
    .map(cluster => {
      const [lead] = cluster.members
      const sections = cluster.members.map(m => m.section)
      return {
        id: lead.item.link,
        lead,
        coverage: cluster.members,
        newsroomCount: new Set(cluster.members.map(m => m.publisher.id)).size,
        section: dominantSection(sections),
        publishedAt: lead.item.publishedAt,
      }
    })
    .sort(
      (a, b) =>
        b.newsroomCount - a.newsroomCount ||
        publishedTime(b.lead.item) - publishedTime(a.lead.item),
    )
}

/** Groups stories under their section, in `sections` order, empties dropped. */
export function groupStoriesBySection(
  stories: ExploreStory[],
  sections: ExploreSection[],
): {section: ExploreSection; stories: ExploreStory[]}[] {
  return sections
    .map(section => ({
      section,
      stories: stories.filter(story => story.section.id === section.id),
    }))
    .filter(group => group.stories.length > 0)
}

/**
 * The section most of a cluster's articles agree on. Outlets file the same
 * event under different desks, so the majority reads truer than the lead's
 * own label; ties fall back to the first member's section.
 */
function dominantSection(sections: ExploreSection[]): ExploreSection {
  const counts = new Map<string, number>()
  for (const section of sections) {
    counts.set(section.id, (counts.get(section.id) ?? 0) + 1)
  }
  let best = sections[0] ?? EXPLORE_SECTION_OTHER
  // A real section always beats "More stories" at equal weight.
  for (const section of sections) {
    const isBetter =
      (counts.get(section.id) ?? 0) > (counts.get(best.id) ?? 0) ||
      (best.id === EXPLORE_SECTION_OTHER.id &&
        section.id !== EXPLORE_SECTION_OTHER.id &&
        (counts.get(section.id) ?? 0) === (counts.get(best.id) ?? 0))
    if (isBetter) best = section
  }
  return best
}

function isSameStory(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  let shared = 0
  for (const term of a) {
    if (b.has(term)) shared++
  }
  if (shared < MIN_SHARED_TERMS) return false
  return (2 * shared) / (a.size + b.size) >= MIN_SIMILARITY
}

/*
 * Words too common to identify a story, across the languages the registry's
 * publishers write in. Short words are dropped by length, so this only needs
 * the frequent long ones.
 */
const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'amid',
  'among',
  'because',
  'been',
  'before',
  'being',
  'between',
  'could',
  'dans',
  'despite',
  'does',
  'donde',
  'during',
  'from',
  'have',
  'into',
  'more',
  'most',
  'much',
  'niet',
  'over',
  'para',
  'plus',
  'pour',
  'said',
  'says',
  'should',
  'since',
  'some',
  'such',
  'than',
  'that',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'under',
  'voor',
  'what',
  'when',
  'where',
  'which',
  'while',
  'will',
  'with',
  'without',
  'would',
  'your',
])

/**
 * A headline reduced to the words that identify its story: lowercased, split on
 * non-letters, stopwords and short words dropped. Numbers are kept whole
 * (`78%`, `2026`) since figures often separate two stories on one subject.
 */
function headlineTerms(title: string): Set<string> {
  const terms = new Set<string>()
  for (const raw of title.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue
    const isNumber = /^\p{N}+$/u.test(raw)
    if (!isNumber && (raw.length < 4 || STOP_WORDS.has(raw))) continue
    terms.add(raw)
  }
  return terms
}

function publishedTime(item: RssItem): number {
  const time = item.publishedAt ? new Date(item.publishedAt).getTime() : NaN
  return Number.isNaN(time) ? 0 : time
}
