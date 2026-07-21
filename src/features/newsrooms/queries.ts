import {
  AppBskyEmbedExternal,
  type AppBskyFeedDefs,
  type AppBskyFeedPost,
} from '@atproto/api'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAgent} from '#/state/session'
import {buildRssFetchUrl} from './rss/config'
import {extractOgImage, parseRssFeed} from './rss/parse'
import {type RssItem} from './rss/types'

const RSS_ARTICLES_TOTAL = 7

export const createRssArticlesQueryKey = (args: {urls: string[]}) =>
  createQueryKey('newsroomRssArticles', args)

/**
 * The publisher's latest real articles, merged across its RSS/Atom feeds and
 * sorted newest-first. This is the page's editorial spine - the outlet's own
 * published front page rather than reverse-chron social posts.
 */
export function useRssArticlesQuery({urls}: {urls: string[]}) {
  return useQuery({
    queryKey: createRssArticlesQueryKey({urls}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: urls.length > 0,
    queryFn: async () => {
      const feeds = await Promise.all(
        urls.map(async url => {
          try {
            const res = await fetch(buildRssFetchUrl(url), {
              headers: {
                Accept: 'application/rss+xml, application/xml, text/xml',
              },
            })
            if (!res.ok) return [] as RssItem[]
            return parseRssFeed(await res.text())
          } catch {
            // A single failing feed should not empty the front page.
            return [] as RssItem[]
          }
        }),
      )

      const seen = new Set<string>()
      return feeds
        .flat()
        .filter(item => {
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? 0).getTime() -
            new Date(a.publishedAt ?? 0).getTime(),
        )
        .slice(0, RSS_ARTICLES_TOTAL)
    },
  })
}

export const createArticleDiscussionQueryKey = (args: {
  url: string
  publisherDid?: string
}) => createQueryKey('newsroomArticleDiscussion', args)

/**
 * The in-network conversation about a specific article: posts across the network
 * that link to its URL. This is the page's reason to exist - the discussion the
 * publisher's own site and the scattered home feed don't put next to the piece.
 *
 * `searchPosts` indexes link facets, so a URL query surfaces posts that shared
 * it; we then keep only posts that genuinely reference the URL (rather than
 * merely matching its tokens) and rank by engagement.
 *
 * When the publisher itself posted the article, that post is the article's
 * canonical thread: it is pinned first and returned as `anchor`, so sharing can
 * quote it (growing one conversation) instead of starting a parallel one.
 */
export function useArticleDiscussionQuery({
  url,
  publisherDid,
  enabled = true,
}: {
  url: string
  publisherDid?: string
  enabled?: boolean
}) {
  const agent = useAgent()

  return useQuery({
    queryKey: createArticleDiscussionQueryKey({url, publisherDid}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && !!url,
    queryFn: async () => {
      const res = await agent.app.bsky.feed.searchPosts({
        q: url,
        url,
        sort: 'top',
        limit: 25,
      })
      const posts = res.data.posts.filter(post => postReferencesUrl(post, url))
      let anchor = publisherDid
        ? (posts.find(post => post.author.did === publisherDid) ?? null)
        : null

      /*
       * The publisher's post may rank below the first page of top results. A
       * focused author lookup prevents us from treating that as "not posted"
       * and opening a standalone link embed instead of the canonical quote.
       */
      if (!anchor && publisherDid) {
        try {
          const publisherRes = await agent.app.bsky.feed.searchPosts({
            q: url,
            url,
            author: publisherDid,
            sort: 'latest',
            limit: 100,
          })
          anchor =
            publisherRes.data.posts.find(post =>
              postReferencesUrl(post, url),
            ) ?? null
        } catch {
          /* A failed anchor lookup should not hide the broader discussion. */
        }
      }

      const ordered = anchor
        ? [anchor, ...posts.filter(post => post.uri !== anchor.uri)]
        : posts
      const total = Math.max(res.data.hitsTotal ?? posts.length, ordered.length)
      return {posts: ordered, total, anchor}
    },
  })
}

/** Whether a post links to `url`, comparing normalized host + path. */
function postReferencesUrl(
  post: AppBskyFeedDefs.PostView,
  url: string,
): boolean {
  const target = normalizeUrl(url)
  if (!target) return false
  for (const candidate of postUrls(post)) {
    if (normalizeUrl(candidate) === target) return true
  }
  return false
}

/** All URLs a post points at: external embed, link facets, and raw text. */
function postUrls(post: AppBskyFeedDefs.PostView): string[] {
  const urls: string[] = []

  if (AppBskyEmbedExternal.isView(post.embed) && post.embed.external?.uri) {
    urls.push(post.embed.external.uri)
  }

  const record = post.record as AppBskyFeedPost.Record
  for (const facet of record.facets ?? []) {
    for (const feature of facet.features) {
      const uri = (feature as {uri?: string}).uri
      if (typeof uri === 'string') urls.push(uri)
    }
  }
  if (typeof record.text === 'string') {
    const textUrls = record.text.match(/https?:\/\/\S+/gi)
    if (textUrls) urls.push(...textUrls)
  }

  return urls
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '').toLowerCase()
    return host + path
  } catch {
    return ''
  }
}

export const createOgImageQueryKey = (args: {url: string}) =>
  createQueryKey('newsroomOgImage', args)

/**
 * The full-resolution og:image scraped from an article page, used to replace
 * the small, soft feed thumbnail on the hero (only - scraping the HTML costs a
 * full page fetch per article). Results are cached for an hour and React Query
 * dedupes concurrent requests for the same URL.
 */
export function useOgImageQuery({
  url,
  enabled = true,
}: {
  url: string
  enabled?: boolean
}) {
  return useQuery({
    queryKey: createOgImageQueryKey({url}),
    staleTime: STALE.HOURS.ONE,
    enabled: enabled && !!url,
    queryFn: async () => {
      try {
        const res = await fetch(buildRssFetchUrl(url), {
          headers: {Accept: 'text/html'},
        })
        if (!res.ok) return null
        return extractOgImage(await res.text()) ?? null
      } catch {
        return null
      }
    },
  })
}
