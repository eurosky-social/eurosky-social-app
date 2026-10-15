import {
  type ExploreArticle,
  type ExploreOutlet,
  type ExploreStory,
} from '../explore/cluster'
import {type ExploreSection} from '../explore/sections'
import {type RssItem} from '../rss/types'
import {type DutchArticle, type DutchTheme, type DutchThread} from './types'

/**
 * A story in the shape the spread renders, built from one of the labeler's
 * threads rather than from `clusterArticles`.
 *
 * An `ExploreStory` plus what the API knows and RSS cannot, so the existing
 * components render it unchanged and only the Dutch-specific surfaces read the
 * extra fields.
 */
export interface DutchExploreStory extends ExploreStory {
  /**
   * The matched discussion, which the API counts with the thread. The eurosky
   * spread has to search for this per article; here it is free, so the page
   * can show post counts on every story rather than only the lead.
   */
  postCount: number
  /** Province label values the thread is labeled for, busiest first. */
  provinces: string[]
  /** The countries of the outlets that covered it, as ISO codes. */
  countries: string[]
}

/**
 * Maps one thread onto the page's shape. Returns undefined for a thread with
 * no lead article: the API drops articles that age out of the archive, leaving
 * a thread with nothing to render.
 *
 * `sectionForTheme` resolves the thread's theme slug onto one of the spread's
 * sections; it is passed in rather than imported so the mapping stays one
 * decision in one place (see `themeSections`).
 *
 * The service has already applied the reader's preferences (see
 * `DutchThreadView`): the articles are the ones in their languages and places,
 * and `leadIn` is the lead in one of their languages. Boosted outlets'
 * articles come first after the lead. `view` is how the thread was read, kept
 * so the article page can read it the same way.
 */
export function adaptThread(
  thread: DutchThread,
  sectionForTheme: (theme: string | null) => ExploreSection,
  view?: string,
): DutchExploreStory | undefined {
  const leadArticle = thread.leadIn ?? thread.lead
  if (!leadArticle) return undefined

  const section = sectionForTheme(thread.theme)
  const provinces = rankedProvinces(thread.provinces)

  /*
   * The thread's articles come grouped by event, each event leading with its
   * own. The thread's lead is usually one of them, so the coverage is read
   * once by URL.
   */
  const seen = new Set<string>([leadArticle.uri])
  const articles = [
    ...(thread.lead ? [thread.lead] : []),
    ...thread.events.flatMap(event => [
      ...(event.lead ? [event.lead] : []),
      ...event.articles,
    ]),
  ].filter(article => {
    if (seen.has(article.uri)) return false
    seen.add(article.uri)
    return true
  })
  /*
   * Stable, so each part keeps the events' order. The service orders each
   * event this way, but the events are concatenated here.
   */
  const ordered = [
    ...articles.filter(article => article.boosted),
    ...articles.filter(article => !article.boosted),
  ]
  const lead = adaptArticle(leadArticle, section)

  return {
    id: threadStoryId(thread),
    source: 'dutch',
    lead,
    coverage: [lead, ...ordered.map(article => adaptArticle(article, section))],
    /*
     * The API counts distinct outlets across every article of the thread,
     * including those beyond the few it returns per event, so this reads
     * truer than the length of `coverage`.
     */
    outletCount: thread.counts.outlets,
    section,
    publishedAt: leadArticle.publishedAt,
    postCount: thread.counts.posts,
    provinces,
    regions: provinces,
    countries: thread.countries,
    view,
  }
}

/**
 * A thread as a story id: its key, which keeps across refits, and its scope,
 * since a key names a thread within one scope's fits.
 */
export function threadStoryId(thread: Pick<DutchThread, 'key' | 'scope'>) {
  return `${thread.scope}:${thread.key}`
}

/** The thread a story id names, or undefined for one not built here. */
export function parseThreadStoryId(
  id: string,
): {scope: string; key: string} | undefined {
  const [scope, key] = id.split(':')
  return scope && key ? {scope, key} : undefined
}

/**
 * An article as the card reads it. The labeler's article and an RSS item carry
 * the same facts under different names, so this is a rename rather than a
 * parse - which is why the page needs no second rendering path.
 */
function adaptArticle(
  article: DutchArticle,
  section: ExploreSection,
): ExploreArticle {
  return {
    publisher: outletFor(article),
    item: articleItem(article),
    section,
  }
}

/** An article as the cards' feed item, which is what every card reads. */
export function articleItem(article: DutchArticle): RssItem {
  return {
    id: article.uri,
    title: article.title ?? '',
    link: article.uri,
    publishedAt: article.publishedAt,
    description: article.summary ?? undefined,
    imageUrl: article.imageUrl ?? undefined,
    /*
     * The labeler's own label values (`dutch`, `nl-utrecht`) stand in for the
     * RSS categories. They do not name a desk, so they never drive sectioning
     * - the theme does that - but they carry the province through to the UI.
     */
    categories: article.labels,
  }
}

/**
 * The outlet that ran an article. The site host is the key, as for an RSS
 * outlet: two articles from the same site must land on the same outlet or they
 * read as separate coverage and inflate the story's outlet count. Where the
 * service knows the outlet's Bluesky account, its DID comes along, which gives
 * the card an avatar and a frontpage link.
 */
export function outletFor(article: DutchArticle): ExploreOutlet {
  const host = hostOf(article.siteUrl ?? article.uri)
  const outlet = article.outlet
  return {
    id: host || (outlet?.slug ?? 'unknown'),
    slug: outlet?.slug ?? undefined,
    did: outlet?.did ?? undefined,
    name: outlet?.name ?? host,
    site: host || undefined,
    categories: article.province ? [article.province] : [],
  }
}

/** Province label values a story carries, busiest first, ties alphabetical. */
function rankedProvinces(provinces: Record<string, number>): string[] {
  return Object.entries(provinces)
    .filter(([, count]) => count > 0)
    .sort(([aVal, aCount], [bVal, bCount]) =>
      bCount === aCount ? aVal.localeCompare(bVal) : bCount - aCount,
    )
    .map(([val]) => val)
}

/** The registrable host of a URL, `www.` dropped; empty when unparseable. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * The spread's sections, built from the themes the API actually serves.
 *
 * The eurosky spread keeps a hardcoded section list because it reads free-form
 * RSS categories and has to normalize them. Here the themes are already one
 * curated vocabulary, so the sections are whatever the service says they are -
 * which means a theme added in the pipeline appears on the page with no change
 * here. Order follows the API's (most stories first).
 */
export function themeSections(themes: DutchTheme[]): ExploreSection[] {
  return themes.map(theme => ({
    id: theme.slug,
    /*
     * The API's names are already localized (`name` / `nameNl`), so they are
     * carried as data rather than as `msg` descriptors, which a build-time
     * extractor could not see anyway.
     */
    label: {id: theme.slug, message: theme.name},
    terms: [],
  }))
}
