import {type Client, type UriString} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {useQueries, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {app} from '#/lexicons'
import {engagementScore, postReferencesUrl, postUrls} from './postLinks'
import {buildRssFetchUrl} from './rss/config'
import {extractOgImage, parseRssFeed} from './rss/parse'
import {type RssItem} from './rss/types'

export {engagementScore, postUrls}

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
 * Shared query definition for an article's discussion, so the single-article
 * hook and the front page's all-articles lookup hit one cache entry per URL.
 */
function articleDiscussionQueryOptions({
  url,
  publisherDid,
  client,
}: {
  url: string
  publisherDid?: string
  client: Client
}) {
  return {
    queryKey: createArticleDiscussionQueryKey({url, publisherDid}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!url,
    queryFn: async () => {
      const data = await client.call(app.bsky.feed.searchPosts, {
        q: url,
        url: url as UriString,
        sort: 'top',
        limit: 25,
      })
      const posts = data.posts.filter(post => postReferencesUrl(post, url))
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
          const publisherData = await client.call(app.bsky.feed.searchPosts, {
            q: url,
            url: url as UriString,
            author: publisherDid as DidString,
            sort: 'latest',
            limit: 100,
          })
          anchor =
            publisherData.posts.find(post => postReferencesUrl(post, url)) ??
            null
        } catch {
          /* A failed anchor lookup should not hide the broader discussion. */
        }
      }

      /*
       * The publisher's own post wins the top slot - it is the article's
       * canonical thread - and the rest of the conversation ranks by its
       * interactions in the Atmosphere.
       */
      const rest = anchor
        ? posts.filter(post => post.uri !== anchor.uri)
        : posts
      const orderedRest = [...rest].sort(
        (a, b) => engagementScore(b) - engagementScore(a),
      )
      const ordered = anchor ? [anchor, ...orderedRest] : orderedRest
      const total = Math.max(data.hitsTotal ?? posts.length, ordered.length)
      /* The article's pull in the Atmosphere; picks the front page's featured
       * story. */
      const interactions = ordered.reduce(
        (sum, post) => sum + engagementScore(post),
        0,
      )
      return {posts: ordered, total, anchor, interactions}
    },
  }
}

/**
 * The in-network conversation about a specific article: posts across the network
 * that link to its URL. This is the page's reason to exist - the discussion the
 * publisher's own site and the scattered home feed don't put next to the piece.
 *
 * `searchPosts` indexes link facets, so a URL query surfaces posts that shared
 * it; we then keep only posts that genuinely reference the URL (rather than
 * merely matching its tokens).
 *
 * When the publisher itself posted the article, that post is the article's
 * canonical thread: it is pinned first and returned as `anchor`, so sharing can
 * quote it (growing one conversation) instead of starting a parallel one. The
 * remaining posts rank by their Atmosphere interactions (likes, reposts,
 * replies, quotes).
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
  const client = useAppviewClient()
  const options = articleDiscussionQueryOptions({url, publisherDid, client})
  return useQuery({...options, enabled: enabled && options.enabled})
}

/**
 * The discussions for a whole front page of articles at once, one cache-shared
 * query per URL. The front page uses the per-article `interactions` totals to
 * feature the story the Atmosphere engaged with most.
 */
export function useArticleDiscussionsQuery({
  urls,
  publisherDid,
}: {
  urls: string[]
  publisherDid?: string
}) {
  const client = useAppviewClient()
  return useQueries({
    queries: urls.map(url =>
      articleDiscussionQueryOptions({url, publisherDid, client}),
    ),
  })
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
