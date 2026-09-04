import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/*
 * Pure helpers over a PostView, shared by the newsroom discussion and the
 * Live section. Kept free of React and query imports so they can be unit
 * tested and reused without pulling in the app shell.
 */

/** A post's total interactions in the Atmosphere; ranks the discussion. */
export function engagementScore(post: app.bsky.feed.defs.PostView): number {
  return (
    (post.likeCount ?? 0) +
    (post.repostCount ?? 0) +
    (post.replyCount ?? 0) +
    (post.quoteCount ?? 0)
  )
}

/** Whether a post links to `url`, comparing normalized host + path. */
export function postReferencesUrl(
  post: app.bsky.feed.defs.PostView,
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
export function postUrls(post: app.bsky.feed.defs.PostView): string[] {
  const urls: string[] = []

  if (
    bsky.isType(app.bsky.embed.external.view, post.embed) &&
    post.embed.external?.uri
  ) {
    urls.push(post.embed.external.uri)
  }

  if (!bsky.isType(app.bsky.feed.post, post.record)) return urls
  const record = post.record
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

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '').toLowerCase()
    return host + path
  } catch {
    return ''
  }
}
