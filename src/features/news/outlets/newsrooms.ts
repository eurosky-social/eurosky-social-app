import {useQuery} from '@tanstack/react-query'

import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {type RssItem} from '../rss/types'
import {PUBLISHER_API_URL} from './config'

/**
 * A newsroom as the publisher's `/api/newsrooms` lists it: an outlet an
 * operator listed for the app.
 */
export interface Newsroom {
  /** The same slug the news aggregator files the outlet under. */
  slug: string
  did: string | null
  name: string
  handle: string | null
  avatar: string | null
  accent: string | null
  domains: string[]
  categories: string[]
  reporterDids: string[]
}

/** One of a newsroom's latest articles, from `/api/newsrooms/{slug}/articles`. */
export interface NewsroomArticle {
  id: string
  title: string | null
  url: string
  summary: string | null
  image: string | null
  publishedAt: string | null
  /** Present only where the publisher posted it for the outlet. */
  postUri: string | null
}

export const createNewsroomsQueryKey = () => createQueryKey('newsrooms', {})

export const createNewsroomArticlesQueryKey = (args: {
  slug: string
  limit: number
}) => createQueryKey('newsroomArticles', args)

/**
 * The publisher's listed newsrooms, by name. Public and unauthenticated, so it
 * reads the same signed in or out. Empty where the publisher is not configured.
 */
export function useNewsroomsQuery({enabled = true}: {enabled?: boolean} = {}) {
  const query = useQuery({
    queryKey: createNewsroomsQueryKey(),
    /* Listing a newsroom is an operator's decision, made on the order of days. */
    staleTime: STALE.HOURS.ONE,
    enabled: enabled && PUBLISHER_API_URL !== '',
    async queryFn() {
      try {
        const data = await fetchPublisherApi<{newsrooms: Newsroom[]}>(
          '/api/newsrooms',
        )
        return data.newsrooms
      } catch (error) {
        logger.error('newsrooms: failed to load', {safeMessage: error})
        throw error
      }
    },
  })

  return {
    /** Undefined until loaded, or for good where there is no publisher. */
    newsrooms: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

/**
 * A newsroom's latest articles, from the feeds it shows on its page, each
 * article once however many of them carry it.
 */
export function useNewsroomArticlesQuery({
  slug,
  limit,
  enabled = true,
}: {
  slug?: string
  limit: number
  enabled?: boolean
}) {
  return useQuery({
    queryKey: createNewsroomArticlesQueryKey({slug: slug ?? '', limit}),
    /* The publisher polls feeds every few minutes; a card need not chase them. */
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && !!slug && PUBLISHER_API_URL !== '',
    async queryFn() {
      try {
        const data = await fetchPublisherApi<{articles: NewsroomArticle[]}>(
          `/api/newsrooms/${encodeURIComponent(slug!)}/articles?limit=${limit}`,
        )
        return data.articles
      } catch (error) {
        logger.error('newsroomArticles: failed to load', {safeMessage: error})
        throw error
      }
    },
  })
}

/** A newsroom article in the shape the news pages render and link from. */
export function newsroomArticleItem(article: NewsroomArticle): RssItem {
  return {
    id: article.id,
    title: article.title ?? '',
    link: article.url,
    publishedAt: article.publishedAt ?? undefined,
    description: article.summary ?? undefined,
    imageUrl: article.image ?? undefined,
  }
}

async function fetchPublisherApi<T>(path: string): Promise<T> {
  const url = `${PUBLISHER_API_URL}${path}`
  const res = await fetch(url, {headers: {accept: 'application/json'}})
  if (!res.ok) throw new Error(`Publisher API ${res.status} for ${url}`)
  return (await res.json()) as T
}
