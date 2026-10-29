import {describe, expect, it} from '@jest/globals'

import {type FeedPostSliceItem} from '#/state/queries/post-feed'
import {articleFromPost, type EditorialArticle} from './articles'
import {
  articleSize,
  curateArticles,
  curateItems,
  curationRecordSchema,
  defaultCuration,
  FRONTPAGE_COLLECTION,
  hidePost,
  insertItem,
  isAllowedSlotUri,
  isOwnPostUri,
  MAX_CURATED_POSTS,
  reorderPosts,
  restorePost,
  setArticleSize,
  setIncludeLatest,
  setLeadPost,
  setStarterPackView,
  starterPackView,
} from './curation'

const DID = 'did:plc:y57igqldvutzs7gpmmrrqbw7'
const uri = (id: string) => `at://${DID}/app.bsky.feed.post/${id}` as const
function article(id: string): EditorialArticle {
  return articleFromPost({
    uri: uri(id),
    post: {uri: uri(id)},
    record: {text: id},
  } as FeedPostSliceItem)
}
const articles = ['a', 'b', 'c', 'd'].map(article)
const visible = articles.map(post => post.item.uri)
const ids = (items: EditorialArticle[]) => items.map(post => post.item.uri)

function record(overrides = {}) {
  return {
    $type: FRONTPAGE_COLLECTION,
    version: 1,
    ...defaultCuration(),
    updatedAt: '2026-10-28T12:00:00Z',
    ...overrides,
  }
}

describe('front page selection', () => {
  it('uses latest-first for an account without editorial choices', () => {
    expect(ids(curateArticles(articles, defaultCuration()))).toEqual(visible)
  })

  it('deduplicates canonical article links with saved picks winning over newer copies', () => {
    const newest = {
      ...article('new'),
      url: 'https://www.wired.com/story/demo/?utm_source=bluesky',
    }
    const saved = {
      ...article('saved'),
      url: 'http://wired.com/story/demo#comments',
    }
    expect(ids(curateArticles([newest, saved], defaultCuration()))).toEqual([
      newest.item.uri,
    ])
    expect(
      ids(
        curateArticles([newest, saved], {
          ...defaultCuration(),
          order: [saved.item.uri],
        }),
      ),
    ).toEqual([saved.item.uri])
    expect(newest.url).toBe(
      'https://www.wired.com/story/demo/?utm_source=bluesky',
    )
  })

  it('promotes an explicit lead and respects order before adding new arrivals', () => {
    const curation = setLeadPost(
      {...defaultCuration(), order: [uri('b'), uri('a')]},
      uri('d'),
    )
    expect(ids(curateArticles(articles, curation))).toEqual([
      uri('d'),
      uri('b'),
      uri('a'),
      uri('c'),
    ])
  })

  it('hides without deleting a post, restores it, and removes a hidden lead', () => {
    const curation = setLeadPost(defaultCuration(), uri('c'))
    const hidden = hidePost(curation, uri('c'))
    expect(hidden.leadPost).toBeUndefined()
    expect(ids(curateArticles(articles, hidden))).not.toContain(uri('c'))
    expect(
      curateArticles(articles, restorePost(hidden, uri('c'))),
    ).toHaveLength(4)
    expect(curation.leadPost).toBe(uri('c'))
  })

  it('can freeze the visible selection and exclude future posts', () => {
    const selected = setIncludeLatest(defaultCuration(), false, visible)
    expect(
      ids(curateArticles([article('new'), ...articles], selected)),
    ).toEqual(visible)
    expect(curateArticles(articles, {...selected, order: []})).toEqual([])
  })

  it('ignores references to missing or deleted posts', () => {
    const curation = {
      includeLatest: false,
      order: [uri('missing'), uri('b')],
      hidden: [],
      leadPost: uri('missing'),
    }
    expect(ids(curateArticles(articles, curation))).toEqual([uri('b')])
  })

  it('deduplicates link destinations after giving saved picks priority', () => {
    const duplicate = {...article('older'), url: 'https://example.com/story'}
    const latest = {...article('newer'), url: duplicate.url}
    expect(
      ids(
        curateArticles([latest, duplicate], {
          ...defaultCuration(),
          order: [duplicate.item.uri],
        }),
      ),
    ).toEqual([duplicate.item.uri])
  })
})

describe('drag-to-reorder', () => {
  it('inserts a story before another and makes the first story the lead', () => {
    const result = reorderPosts(
      defaultCuration(),
      visible,
      uri('d'),
      uri('a'),
      'before',
    )
    expect(result.order).toEqual([uri('d'), uri('a'), uri('b'), uri('c')])
    expect(result.leadPost).toBe(uri('d'))
    expect(ids(curateArticles(articles, result))).toEqual(result.order)
  })

  it('can drop the lead after a later story', () => {
    const result = reorderPosts(
      setLeadPost(defaultCuration(), uri('a')),
      visible,
      uri('a'),
      uri('c'),
      'after',
    )
    expect(result.order).toEqual([uri('b'), uri('c'), uri('a'), uri('d')])
    expect(result.leadPost).toBe(uri('b'))
  })

  it('preserves older saved references that are not on the current feed page', () => {
    const curation = {...defaultCuration(), order: [uri('old')]}
    expect(
      reorderPosts(curation, visible, uri('d'), uri('b'), 'before').order,
    ).toEqual([uri('a'), uri('d'), uri('b'), uri('c'), uri('old')])
  })

  it('leaves canceled, invalid, and no-op moves untouched', () => {
    const curation = defaultCuration()
    expect(reorderPosts(curation, visible, uri('a'), uri('a'), 'before')).toBe(
      curation,
    )
    expect(
      reorderPosts(curation, visible, uri('missing'), uri('a'), 'before'),
    ).toBe(curation)
    expect(reorderPosts(curation, visible, uri('a'), uri('b'), 'before')).toBe(
      curation,
    )
  })

  it('does not mutate the published layout or visible list', () => {
    const original = Object.freeze(defaultCuration())
    const copy = [...visible]
    reorderPosts(original, visible, uri('a'), uri('d'), 'after')
    expect(original.order).toEqual([])
    expect(visible).toEqual(copy)
  })
})

describe('manual slot insertion', () => {
  const feed = `at://${DID}/app.bsky.feed.generator/news`
  const pack = `at://${DID}/app.bsky.graph.starterpack/start`

  it('inserts a hidden post at the selected boundary and restores it', () => {
    const source = hidePost(
      {...defaultCuration(), includeLatest: false, order: visible},
      uri('c'),
    )
    const result = insertItem(
      source,
      [uri('a'), uri('b'), uri('d')],
      uri('c'),
      uri('b'),
    )
    expect(result.order).toEqual([uri('a'), uri('c'), uri('b'), uri('d')])
    expect(result.hidden).not.toContain(uri('c'))
    expect(result.includeLatest).toBe(false)
    expect(source.hidden).toContain(uri('c'))
  })

  it('can insert first, append, and reposition without duplicates', () => {
    expect(
      insertItem(defaultCuration(), visible, feed, uri('a')).leadPost,
    ).toBe(feed)
    expect(insertItem(defaultCuration(), visible, pack, null).order).toEqual([
      ...visible,
      pack,
    ])
    expect(
      insertItem(defaultCuration(), visible, uri('a'), uri('d')).order,
    ).toEqual([uri('b'), uri('c'), uri('a'), uri('d')])
    expect(insertItem(defaultCuration(), [], feed, null).order).toEqual([feed])
  })

  it('preserves references to older saved posts and rejects stale insertion points', () => {
    const curation = {...defaultCuration(), order: [uri('old')]}
    expect(insertItem(curation, visible, feed, uri('b')).order.at(-1)).toBe(
      uri('old'),
    )
    expect(() => insertItem(curation, visible, feed, uri('missing'))).toThrow(
      'InsertionPointUnavailable',
    )
  })

  it('curates mixed posts, feeds and starter packs in exactly the saved order', () => {
    const entries = [...articles, {item: {uri: feed}}, {item: {uri: pack}}]
    const result = curateItems(entries, {
      ...defaultCuration(),
      order: [uri('b'), feed, pack, uri('a')],
      includeLatest: false,
    })
    expect(result.map(value => value.item.uri)).toEqual([
      uri('b'),
      feed,
      pack,
      uri('a'),
    ])
  })

  it('removes resource slots without adding them to the hidden-post archive', () => {
    const result = hidePost(
      {...defaultCuration(), order: [feed, pack], leadPost: feed},
      feed,
    )
    expect(result.order).toEqual([pack])
    expect(result.hidden).toEqual([])
    expect(result.leadPost).toBeUndefined()
  })

  it('allows other creators’ resources but only the publisher’s own posts', () => {
    const schema = curationRecordSchema(DID)
    const otherFeed = 'at://did:plc:other/app.bsky.feed.generator/test'
    const otherPack = 'at://did:plc:other/app.bsky.graph.starterpack/test'
    expect(
      schema.safeParse(
        record({order: [feed, pack, otherFeed, otherPack], leadPost: feed}),
      ).success,
    ).toBe(true)
    expect(isAllowedSlotUri(feed, DID)).toBe(true)
    expect(isAllowedSlotUri(pack, DID)).toBe(true)
    expect(isAllowedSlotUri(otherFeed, DID)).toBe(true)
    for (const invalid of [
      `at://${DID}/app.bsky.graph.list/test`,
      'at://did:plc:other/app.bsky.feed.post/test',
      'at://not-a-did/app.bsky.feed.generator/test',
      `${feed}/extra`,
    ]) {
      expect(isAllowedSlotUri(invalid, DID)).toBe(false)
      expect(schema.safeParse(record({order: [invalid]})).success).toBe(false)
    }
  })
})

describe('starter-pack display modes', () => {
  const pack = `at://${DID}/app.bsky.graph.starterpack/demo`
  it('defaults to people and saves a per-slot posts choice without changing other slots', () => {
    const source = defaultCuration()
    const changed = setStarterPackView(source, pack, 'posts')
    expect(starterPackView(source, pack)).toBe('people')
    expect(starterPackView(changed, pack)).toBe('posts')
    expect(starterPackView(changed, `${pack}-other`)).toBe('people')
    expect(
      setStarterPackView(changed, pack, 'people').starterPackViews,
    ).toEqual([{uri: pack, view: 'people'}])
    expect(curationRecordSchema(DID).safeParse(record(changed)).success).toBe(
      true,
    )
  })
  it('rejects unknown modes, duplicate settings and settings for non-pack slots', () => {
    for (const views of [
      [{uri: pack, view: 'other'}],
      [
        {uri: pack, view: 'posts'},
        {uri: pack, view: 'people'},
      ],
      [{uri: uri('a'), view: 'posts'}],
    ]) {
      expect(
        curationRecordSchema(DID).safeParse(record({starterPackViews: views}))
          .success,
      ).toBe(false)
    }
  })
})

describe('article sizing', () => {
  it('defaults to a medium lead with small supporting stories', () => {
    expect(articleSize(defaultCuration(), uri('a'), true)).toBe('medium')
    expect(articleSize(defaultCuration(), uri('b'), false)).toBe('small')
  })

  it('supports a full-width lead and independently sized supporting stories', () => {
    const curation = setArticleSize(
      setArticleSize(defaultCuration(), uri('a'), 'big'),
      uri('b'),
      'medium',
    )
    expect(articleSize(curation, uri('a'), true)).toBe('big')
    expect(articleSize(curation, uri('b'), false)).toBe('medium')
    expect(articleSize(curation, uri('c'), false)).toBe('small')
    expect(articleSize(hidePost(curation, uri('a')), uri('a'), false)).toBe(
      'big',
    )
  })

  it('promotes a small story to medium when it becomes the lead', () => {
    const curation = setArticleSize(defaultCuration(), uri('a'), 'small')
    expect(articleSize(curation, uri('a'), true)).toBe('medium')
    expect(articleSize(curation, uri('a'), false)).toBe('small')
  })

  it('validates size choices, ownership and uniqueness', () => {
    const schema = curationRecordSchema(DID)
    expect(
      schema.safeParse(record({sizes: [{post: uri('a'), size: 'big'}]}))
        .success,
    ).toBe(true)
    for (const sizes of [
      [{post: uri('a'), size: 'huge'}],
      [
        {post: uri('a'), size: 'big'},
        {post: uri('a'), size: 'small'},
      ],
      [{post: 'at://did:plc:other/app.bsky.feed.post/abc', size: 'big'}],
    ])
      expect(schema.safeParse(record({sizes})).success).toBe(false)
  })
})

describe('public layout validation', () => {
  it('accepts only post URIs owned by this repository', () => {
    expect(isOwnPostUri(uri('abc'), DID)).toBe(true)
    for (const value of [
      'https://example.com',
      `${uri('abc')}/extra`,
      uri('..'),
      `at://${DID}/app.bsky.actor.profile/self`,
      'at://did:plc:other/app.bsky.feed.post/abc',
    ]) {
      expect(isOwnPostUri(value, DID)).toBe(false)
    }
  })

  it('rejects conflicting selections, duplicate entries, and unknown versions', () => {
    const schema = curationRecordSchema(DID)
    expect(schema.safeParse(record()).success).toBe(true)
    for (const value of [
      {order: [uri('a'), uri('a')]},
      {order: [uri('a')], hidden: [uri('a')]},
      {leadPost: uri('a')},
      {version: 2},
      {order: ['at://did:plc:other/app.bsky.feed.post/abc']},
      {
        order: Array.from({length: MAX_CURATED_POSTS + 1}, (_, index) =>
          uri(String(index)),
        ),
      },
    ])
      expect(schema.safeParse(record(value)).success).toBe(false)
  })
})
