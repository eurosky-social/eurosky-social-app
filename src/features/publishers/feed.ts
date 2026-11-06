import {type Client} from '@atproto/lex'
import {type AtIdentifierString} from '@atproto/syntax'

import {type FeedAPI, type FeedAPIResponse} from '#/lib/api/feed/types'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {parseEmbed} from '#/types/bsky/post'
import {PUBLISHERS} from './publishers'

type Source = {
  did: string
  cursor?: string
  queue: app.bsky.feed.defs.FeedViewPost[]
  hasMore: boolean
}

/** Direct appview author feeds, independent of RSS, outlet APIs and editorial layouts. */
export class PublisherFeedAPI implements FeedAPI {
  private sources: Source[] = []
  private seen = new Set<string>()
  private turn = 0
  private page = 0

  constructor(
    private options: {
      client: Client
      videos?: boolean
      dids?: readonly string[]
    },
  ) {}

  private reset() {
    this.sources = (
      this.options.dids ?? PUBLISHERS.map(publisher => publisher.did)
    ).map(did => ({did, queue: [], hasMore: true}))
    this.seen = new Set()
    this.turn = 0
    this.page = 0
  }

  async peekLatest() {
    const probe = new PublisherFeedAPI(this.options)
    return (await probe.fetch({cursor: undefined, limit: 1})).feed[0]
  }

  async fetch({
    cursor,
    limit,
    signal,
  }: {
    cursor: string | undefined
    limit: number
    signal?: AbortSignal
  }): Promise<FeedAPIResponse> {
    if (!cursor) this.reset()
    const pending = this.sources.filter(
      source => source.hasMore && source.queue.length < 2,
    )
    const errors: unknown[] = []
    for (let offset = 0; offset < pending.length; offset += 6) {
      await Promise.all(
        pending.slice(offset, offset + 6).map(async source => {
          try {
            const data = await this.options.client.call(
              app.bsky.feed.getAuthorFeed,
              {
                actor: source.did as AtIdentifierString,
                filter: this.options.videos
                  ? 'posts_with_video'
                  : 'posts_no_replies',
                includePins: false,
                cursor: source.cursor,
                limit: 30,
              },
              {signal},
            )
            source.cursor = data.cursor
            source.hasMore = !!data.cursor && data.feed.length > 0
            for (const item of data.feed) {
              if (
                !isPublisherOriginal(item, source.did) ||
                !bsky.isType(app.bsky.feed.post.main, item.post.record)
              )
                continue
              if (
                Date.parse(item.post.record.createdAt) <
                Date.now() - 7 * 24 * 60 * 60 * 1000
              ) {
                source.hasMore = false
                continue
              }
              if (this.options.videos) {
                const embed = parseEmbed(item.post.embed)
                const media =
                  embed.type === 'post_with_media' ? embed.media : embed
                if (media.type !== 'video' || media.view.presentation === 'gif')
                  continue
              }
              if (this.seen.has(item.post.uri)) continue
              this.seen.add(item.post.uri)
              source.queue.push(item)
            }
          } catch (error) {
            if (signal?.aborted) throw error
            errors.push(error)
          }
        }),
      )
    }
    const feed: app.bsky.feed.defs.FeedViewPost[] = []
    let emptyTurns = 0
    while (
      feed.length < limit &&
      this.sources.length &&
      emptyTurns < this.sources.length
    ) {
      const source = this.sources[this.turn]
      this.turn = (this.turn + 1) % this.sources.length
      const item = source.queue.shift()
      if (item) {
        feed.push(item)
        emptyTurns = 0
      } else {
        emptyTurns++
      }
    }
    if (!feed.length && errors.length) throw errors[0]
    const hasMore = this.sources.some(
      source => source.hasMore || source.queue.length,
    )
    return {feed, cursor: hasMore ? String(++this.page) : undefined}
  }
}

export function isPublisherOriginal(
  item: app.bsky.feed.defs.FeedViewPost,
  did: string,
) {
  return (
    item.post.author.did === did &&
    !item.reason &&
    bsky.isType(app.bsky.feed.post.main, item.post.record) &&
    !item.post.record.reply
  )
}
