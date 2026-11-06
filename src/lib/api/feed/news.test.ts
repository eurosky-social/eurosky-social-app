import {type Client} from '@atproto/lex'

import {NewsFeedAPI} from './news'

type Params = {actor: string; cursor?: string}

function item(actor: string, index: number) {
  return {
    post: {
      uri: `at://${actor}/app.bsky.feed.post/${index}`,
      indexedAt: new Date(Date.now() - index * 1000).toISOString(),
    },
  }
}

/**
 * A client whose author feeds answer after a per-actor delay, each with a
 * per-actor number of posts (2 unless given).
 */
function fakeClient(
  delays: Record<string, number>,
  counts: Record<string, number> = {},
) {
  return {
    call: jest.fn(
      (_method: unknown, {actor, cursor}: Params) =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve(
                cursor
                  ? {feed: []}
                  : {
                      feed: Array.from({length: counts[actor] ?? 2}, (_, i) =>
                        item(actor, i + 1),
                      ),
                      cursor: 'more',
                    },
              ),
            delays[actor] ?? 0,
          ),
        ),
    ),
  } as unknown as Client
}

describe('NewsFeedAPI', () => {
  it('does not hold the first page for a slow source', async () => {
    const api = new NewsFeedAPI({
      client: fakeClient({'did:slow': 3000}),
      dids: ['did:fast1', 'did:fast2', 'did:slow'],
    })

    const started = Date.now()
    const first = await api.fetch({cursor: undefined, limit: 10})
    expect(Date.now() - started).toBeLessThan(2500)
    const firstUris = first.feed.map(entry => entry.post.uri)
    expect(firstUris).toHaveLength(4)
    expect(firstUris.some(uri => uri.includes('did:slow'))).toBe(false)
    expect(first.cursor).toBeDefined()

    // The slow source finishes in the background and joins the next page.
    const second = await api.fetch({cursor: first.cursor, limit: 10})
    const secondUris = second.feed.map(entry => entry.post.uri)
    expect(secondUris.filter(uri => uri.includes('did:slow'))).toHaveLength(2)
  }, 10000)

  it('returns as soon as enough sources answer to fill the page', async () => {
    const api = new NewsFeedAPI({
      client: fakeClient({'did:slow': 3000}),
      dids: ['did:a', 'did:b', 'did:c', 'did:d', 'did:slow'],
    })

    const started = Date.now()
    const page = await api.fetch({cursor: undefined, limit: 4})
    expect(Date.now() - started).toBeLessThan(1000)
    expect(page.feed).toHaveLength(4)
  })

  it('keeps one fast, prolific source from filling the page', async () => {
    const api = new NewsFeedAPI({
      client: fakeClient(
        {'did:b': 200, 'did:c': 300, 'did:d': 400},
        {'did:fast': 30},
      ),
      dids: ['did:fast', 'did:b', 'did:c', 'did:d'],
    })

    const page = await api.fetch({cursor: undefined, limit: 8})
    const fromFast = page.feed.filter(entry =>
      entry.post.uri.includes('did:fast'),
    )
    // Every source answered in time, so each gets its round-robin share.
    expect(fromFast.length).toBeLessThanOrEqual(2)
    expect(page.feed).toHaveLength(8)
  })

  it('caps each source on a page that could not wait for everyone', async () => {
    const api = new NewsFeedAPI({
      client: fakeClient({'did:slow': 3000}, {'did:fast': 30}),
      dids: ['did:fast', 'did:slow'],
    })

    const page = await api.fetch({cursor: undefined, limit: 10})
    expect(page.feed).toHaveLength(2)
    expect(page.cursor).toBeDefined()
  })
})
