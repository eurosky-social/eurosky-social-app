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

/** A client whose author feeds answer after a per-actor delay. */
function fakeClient(delays: Record<string, number>) {
  return {
    call: jest.fn(
      (_method: unknown, {actor, cursor}: Params) =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve(
                cursor
                  ? {feed: []}
                  : {feed: [item(actor, 1), item(actor, 2)], cursor: 'more'},
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

  it('returns a full page as soon as one is queued', async () => {
    const api = new NewsFeedAPI({
      client: fakeClient({'did:slow': 3000}),
      dids: ['did:a', 'did:b', 'did:slow'],
    })

    const started = Date.now()
    const page = await api.fetch({cursor: undefined, limit: 4})
    expect(Date.now() - started).toBeLessThan(1000)
    expect(page.feed).toHaveLength(4)
  })
})
