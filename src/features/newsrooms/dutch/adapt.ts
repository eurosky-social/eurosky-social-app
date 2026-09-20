import {
  type ExploreArticle,
  type ExploreOutlet,
  type ExploreStory,
} from '../explore/cluster'
import {type ExploreSection} from '../explore/sections'
import {type RssItem} from '../rss/types'
import {type DutchArticle, type DutchStory, type DutchTheme} from './types'

/**
 * A story in the shape the spread renders, built from the labeler's own
 * clustering rather than from `clusterArticles`.
 *
 * An `ExploreStory` plus what the API knows and RSS cannot, so the existing
 * components render it unchanged and only the Dutch-specific surfaces read the
 * extra fields.
 */
export interface DutchExploreStory extends ExploreStory {
  /**
   * The matched discussion, which the API hands over with the story. The
   * eurosky spread has to search for this per article; here it is free, so the
   * page can show post counts on every story rather than only the lead.
   */
  postCount: number
  /** Province label values the story is labeled for, busiest first. */
  provinces: string[]
}

/**
 * Maps one API story onto the page's shape. Returns undefined for a story with
 * no lead article: the API drops articles that age out of the archive, leaving
 * a cluster with nothing to render.
 *
 * `sectionForTheme` resolves the story's theme slug onto one of the spread's
 * sections; it is passed in rather than imported so the mapping stays one
 * decision in one place (see `themeSections`).
 */
export function adaptStory(
  story: DutchStory,
  sectionForTheme: (theme: string | null) => ExploreSection,
): DutchExploreStory | undefined {
  if (!story.lead) return undefined

  const section = sectionForTheme(story.theme)
  const lead = adaptArticle(story.lead, section)
  const coverage = [
    lead,
    ...story.articles.map(article => adaptArticle(article, section)),
  ]

  return {
    id: String(story.id),
    lead,
    coverage,
    /*
     * The API counts distinct outlets across every article of the story,
     * including any beyond the three it returns, so this reads truer than the
     * length of `coverage`.
     */
    newsroomCount: story.counts.outlets,
    section,
    publishedAt: story.lead.publishedAt,
    postCount: story.counts.posts,
    provinces: rankedProvinces(story.provinces),
  }
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
  const item: RssItem = {
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

  return {
    publisher: outletFor(article),
    item,
    section,
  }
}

/**
 * The outlet that ran an article. The API identifies outlets by display name
 * and site URL rather than by id, so the host is the stable key: two articles
 * from the same site must land on the same outlet or they read as separate
 * coverage and inflate the story's newsroom count.
 */
export function outletFor(article: DutchArticle): ExploreOutlet {
  const host = hostOf(article.siteUrl ?? article.uri)
  return {
    id: host || (article.outlet ?? 'unknown'),
    name: article.outlet ?? host,
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
