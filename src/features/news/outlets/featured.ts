import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {articleItem} from '../dutch/adapt'
import {
  useDutchOutletArticlesQuery,
  useDutchOutletsByRefQuery,
} from '../dutch/queries'
import {type DutchOutletDetail, type DutchOutletListing} from '../dutch/types'
import {outletCoverage, outletsForInterest} from '../explore/interests'
import {type RssItem} from '../rss/types'
import {FEATURED_OUTLET_REFS} from './config'
import {
  type Newsroom,
  newsroomArticleItem,
  useNewsroomArticlesQuery,
  useNewsroomsQuery,
} from './newsrooms'

/** An outlet the news page and the outlets tab feature. */
export interface FeaturedOutlet {
  /** Its frontpage's address: the aggregator's slug, shared by the publisher. */
  slug: string
  did?: string
  name: string
  /** The site its articles are on, whose icon stands in for a missing avatar. */
  site?: string
  /**
   * Where it was named: the configured list (and so read from the news
   * aggregator) or the publisher's newsrooms, which serve its articles.
   */
  source: 'config' | 'newsroom'
}

/**
 * The configured outlets the aggregator knows, in their order, then the
 * publisher's newsrooms not already among them, up to `limit` if there is one.
 * An outlet named twice - by slug, or by its account - is featured once.
 */
export function mergeFeaturedOutlets(
  configured: (DutchOutletDetail | null | undefined)[],
  newsrooms: Newsroom[] | undefined,
  limit?: number,
): FeaturedOutlet[] {
  const featured: FeaturedOutlet[] = []
  const seen = new Set<string>()
  function add(outlet: FeaturedOutlet) {
    if (seen.has(outlet.slug) || (outlet.did && seen.has(outlet.did))) return
    seen.add(outlet.slug)
    if (outlet.did) seen.add(outlet.did)
    featured.push(outlet)
  }

  for (const outlet of configured) {
    if (!outlet) continue
    add({
      slug: outlet.slug,
      did: outlet.did ?? undefined,
      name: outlet.name,
      site: outlet.domains[0],
      source: 'config',
    })
  }
  for (const newsroom of newsrooms ?? []) {
    add({
      slug: newsroom.slug,
      did: newsroom.did ?? undefined,
      name: newsroom.name,
      site: newsroom.domains[0],
      source: 'newsroom',
    })
  }
  return limit === undefined ? featured : featured.slice(0, limit)
}

/**
 * The outlets to feature for one interest: its outlets less those unticked,
 * and, when it names themes, only those with a current story on one of them
 * (or that the service says nothing about). The generally featured ones among
 * them lead, then the rest by how many current stories they ran on its themes
 * (on any, without themes). Outlets are placed by country only, so a province
 * keeps every outlet of its country.
 */
export function featuredForInterest(
  interest: NewsInterest,
  outlets: DutchOutletListing[],
  limit: number,
  featuredSlugs: string[] = [],
): FeaturedOutlet[] {
  const coverage = (outlet: DutchOutletListing) =>
    outletCoverage(outlet, interest.themes)
  return outletsForInterest(interest, outlets)
    .filter(
      outlet =>
        outlet.articles > 0 &&
        !interest.excludedOutlets.includes(outlet.slug) &&
        (interest.themes.length === 0 || coverage(outlet) !== 0),
    )
    .sort(
      (x, y) =>
        Number(featuredSlugs.includes(y.slug)) -
          Number(featuredSlugs.includes(x.slug)) ||
        (coverage(y) ?? 0) - (coverage(x) ?? 0),
    )
    .slice(0, limit)
    .map(outlet => ({
      slug: outlet.slug,
      did: outlet.did ?? undefined,
      name: outlet.name,
      site: outlet.domains[0],
      source: 'config' as const,
    }))
}

/**
 * The featured outlets: the configured list first, then the publisher's
 * newsrooms. With a `limit`, the newsrooms are only asked for when the
 * configured list comes up short of it.
 */
export function useFeaturedOutlets({limit}: {limit?: number} = {}): {
  outlets: FeaturedOutlet[]
  isLoading: boolean
} {
  const configured = useDutchOutletsByRefQuery({refs: FEATURED_OUTLET_REFS})
  const found = configured.outlets.filter(Boolean).length
  const needsNewsrooms =
    !configured.isLoading && (limit === undefined || found < limit)
  const newsrooms = useNewsroomsQuery({enabled: needsNewsrooms})
  return {
    outlets: mergeFeaturedOutlets(
      configured.outlets,
      needsNewsrooms ? newsrooms.newsrooms : undefined,
      limit,
    ),
    isLoading: configured.isLoading || (needsNewsrooms && newsrooms.isLoading),
  }
}

/**
 * A featured outlet's latest articles, from wherever it was named: the
 * aggregator for a configured outlet, the publisher for a newsroom.
 */
export function useFeaturedOutletArticles(
  outlet: FeaturedOutlet,
  limit: number,
): {articles: RssItem[] | undefined; isLoading: boolean} {
  const fromConfig = outlet.source === 'config'
  const aggregator = useDutchOutletArticlesQuery({
    slug: outlet.slug,
    limit,
    enabled: fromConfig,
  })
  const publisher = useNewsroomArticlesQuery({
    slug: outlet.slug,
    limit,
    enabled: !fromConfig,
  })
  return fromConfig
    ? {
        articles: aggregator.data?.map(articleItem),
        isLoading: aggregator.isLoading,
      }
    : {
        articles: publisher.data?.map(newsroomArticleItem),
        isLoading: publisher.isLoading,
      }
}
