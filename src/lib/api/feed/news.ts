import {type Client} from '@atproto/lex'
import {type AtIdentifierString} from '@atproto/syntax'

import {app} from '#/lexicons'
import {type FeedAPI, type FeedAPIResponse} from './types'

// News should be fresh: stop paginating a source once it goes past this age.
const POST_AGE_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000
// Author feeds are fetched in parallel; bound how many run at once so a large
// source set does not fire dozens of requests simultaneously.
const FETCH_CONCURRENCY = 12
/*
 * How long a page waits for slow sources before going out with what has
 * arrived. The rest keep loading in the background and join later pages, so
 * one slow author feed does not hold up the first screen.
 */
const PAGE_WAIT_MS = 1200
/*
 * On a page that goes out before every source has answered, no source gives
 * more than this: otherwise the first fast source, which returns a whole page
 * of its own posts, fills the top of the feed by itself.
 */
const EARLY_PAGE_PER_SOURCE = 2

type SourceState = {
  did: string
  cursor: string | undefined
  queue: app.bsky.feed.defs.FeedViewPost[]
  hasMore: boolean
}

/**
 * Merges the latest posts from several source accounts into one feed. The
 * appview has no multi-author endpoint, so we fetch each author feed separately
 * and round-robin across them, giving every source equal weight rather than
 * letting a high-frequency one dominate. Per-source cursors live on the
 * instance and are threaded across pages by `usePostFeedQuery`; a fetch with no
 * cursor (a fresh load) resets them.
 */
export class NewsFeedAPI implements FeedAPI {
  client: Client
  dids: string[]
  sources: SourceState[] = []
  seen = new Set<string>()
  itemCursor = 0
  /** Top-ups in flight, so a source is never fetched twice at once. */
  pending = new Map<SourceState, Promise<void>>()
  /** Top-ups waiting for a free slot under FETCH_CONCURRENCY. */
  waiting: (() => void)[] = []
  running = 0

  constructor({client, dids}: {client: Client; dids: string[]}) {
    this.client = client
    this.dids = dids.filter(Boolean)
  }

  reset() {
    this.sources = this.dids.map(did => ({
      did,
      cursor: undefined,
      queue: [],
      hasMore: true,
    }))
    this.seen = new Set()
    this.itemCursor = 0
    this.pending = new Map()
    this.waiting = []
    this.running = 0
  }

  async peekLatest(): Promise<app.bsky.feed.defs.FeedViewPost> {
    const data = await this.client.call(app.bsky.feed.getAuthorFeed, {
      actor: this.dids[0] as AtIdentifierString,
      filter: 'posts_no_replies',
      limit: 1,
    })
    return data.feed[0]
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    if (!cursor) {
      this.reset()
    }

    const minDate = Date.now() - POST_AGE_CUTOFF_MS

    // Refill any source whose queue is running low and still has more to give.
    const stale = this.sources.filter(
      source => source.hasMore && source.queue.length < limit,
    )
    const refills = stale.map(source => this._scheduleTopUp(source, minDate))
    let settled = false
    const allDone = Promise.all(refills).then(() => {
      settled = true
    })
    await Promise.race([allDone, this._pageReady(limit, stale, allDone)])

    const posts = this._takeRoundRobin(
      limit,
      settled ? Infinity : EARLY_PAGE_PER_SOURCE,
    )

    const exhausted = this.sources.every(
      source => !source.hasMore && source.queue.length === 0,
    )
    return {
      feed: posts,
      cursor:
        posts.length > 0 && !exhausted ? String(++this.itemCursor) : undefined,
    }
  }

  /**
   * Resolves once enough of the refilling sources have answered to fill the
   * page one post each, or once PAGE_WAIT_MS has passed with at least one
   * answer to show. Counting sources rather than posts is what keeps the page
   * mixed: a single fast source can queue a full page's worth on its own.
   */
  _pageReady(
    limit: number,
    refilling: SourceState[],
    allDone: Promise<void>,
  ): Promise<void> {
    const needed = Math.min(limit, refilling.length)
    return new Promise(resolve => {
      const started = Date.now()
      const check = () => {
        const answered = refilling.filter(
          source => !this.pending.has(source),
        ).length
        const hasPosts = this.sources.some(source => source.queue.length > 0)
        const waited = Date.now() - started >= PAGE_WAIT_MS
        if (answered >= needed || (waited && hasPosts)) {
          resolve()
        } else {
          timer = setTimeout(check, 100)
        }
      }
      let timer = setTimeout(check, 100)
      void allDone.then(() => clearTimeout(timer))
    })
  }

  /** Starts (or joins) a source's top-up, within the concurrency limit. */
  _scheduleTopUp(source: SourceState, minDate: number): Promise<void> {
    const inFlight = this.pending.get(source)
    if (inFlight) return inFlight
    const run = async () => {
      // Wait for a slot; a finishing top-up hands its slot straight over.
      if (this.running >= FETCH_CONCURRENCY) {
        await new Promise<void>(resolve => this.waiting.push(resolve))
      } else {
        this.running += 1
      }
      try {
        await this._topUp(source, minDate)
      } finally {
        this.pending.delete(source)
        const next = this.waiting.shift()
        if (next) next()
        else this.running -= 1
      }
    }
    const promise = run()
    this.pending.set(source, promise)
    return promise
  }

  async _topUp(source: SourceState, minDate: number) {
    try {
      const data = await this.client.call(app.bsky.feed.getAuthorFeed, {
        actor: source.did as AtIdentifierString,
        filter: 'posts_no_replies',
        cursor: source.cursor,
        limit: 30,
      })
      source.cursor = data.cursor
      if (!data.cursor || data.feed.length === 0) {
        source.hasMore = false
      }
      for (const item of data.feed) {
        if (new Date(item.post.indexedAt).getTime() < minDate) {
          // Author feeds are newest-first, so once we cross the cutoff the rest
          // of this source's history is older too.
          source.hasMore = false
          break
        }
        if (this.seen.has(item.post.uri)) continue
        this.seen.add(item.post.uri)
        source.queue.push(item)
      }
    } catch {
      // A single failing source should not take down the whole feed.
      source.hasMore = false
    }
  }

  // Take one post from each source per pass for equal representation, visiting
  // sources newest-head first so the page still trends fresh.
  _takeRoundRobin(
    limit: number,
    perSource: number,
  ): app.bsky.feed.defs.FeedViewPost[] {
    const posts: app.bsky.feed.defs.FeedViewPost[] = []
    const taken = new Map<SourceState, number>()
    while (posts.length < limit) {
      const ready = this.sources.filter(
        source =>
          source.queue.length > 0 && (taken.get(source) ?? 0) < perSource,
      )
      if (ready.length === 0) break
      ready.sort(
        (a, b) =>
          new Date(b.queue[0].post.indexedAt).getTime() -
          new Date(a.queue[0].post.indexedAt).getTime(),
      )
      for (const source of ready) {
        if (posts.length >= limit) break
        const next = source.queue.shift()
        if (next) {
          posts.push(next)
          taken.set(source, (taken.get(source) ?? 0) + 1)
        }
      }
    }
    return posts
  }
}
