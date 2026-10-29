import {describe, expect, it} from '@jest/globals'

import {type EditorialArticle} from './articles'
import {
  articleSize,
  curateItems,
  curationRecordSchema,
  FRONTPAGE_COLLECTION,
  MAX_CURATED_POSTS,
} from './curation'
import {defaultLayout} from './defaultLayout'
import {type ResourceItem} from './items'

const DID = 'did:plc:y57igqldvutzs7gpmmrrqbw7'
const articles = Array.from(
  {length: 18},
  (_, i) =>
    ({
      item: {uri: `at://${DID}/app.bsky.feed.post/${i}`},
      title: `Story ${i}`,
    }) as EditorialArticle,
)
const pack: ResourceItem = {
  kind: 'starterPack',
  item: {uri: `at://${DID}/app.bsky.graph.starterpack/demo`},
  title: 'Newsroom',
}

describe('automatic front pages', () => {
  it('varies story sizes without changing chronological reading order', () => {
    const result = defaultLayout(articles)
    expect(result.order).toEqual(articles.map(article => article.item.uri))
    expect(new Set(result.sizes?.map(value => value.size))).toEqual(
      new Set(['small', 'medium', 'big']),
    )
    expect(articleSize(result, result.order[0], true)).toBe('medium')
    expect(result.sizes?.[5].size).toBe('big')
    expect(result.sizes?.[7].size).toBe('medium')
  })
  it('puts a starter pack between stories and keeps it out of the lead', () => {
    const result = defaultLayout(articles, pack)
    expect(result.order[4]).toBe(pack.item.uri)
    expect(result.sizes?.[4].size).toBe('small')
    expect(
      curateItems([...articles, pack], result).map(value => value.item.uri),
    ).toEqual(result.order)
    expect(articles).toHaveLength(18)
  })
  it.each([0, 1, 2, 3])('handles a profile with %s posts', count => {
    const result = defaultLayout(articles.slice(0, count), pack)
    expect(result.order).toHaveLength(count + 1)
    expect(result.order).toContain(pack.item.uri)
    if (count) expect(result.order[0]).toBe(articles[0].item.uri)
    if (count > 1)
      expect(result.order.at(-1)).toBe(articles[count - 1].item.uri)
  })
  it('bounds defaults to the public-record limit while leaving newer posts enabled', () => {
    const many = Array.from({length: 125}, (_, i) => ({
      ...articles[0],
      item: {
        ...articles[0].item,
        uri: `at://${DID}/app.bsky.feed.post/${i}` as const,
      },
    }))
    const result = defaultLayout(many, pack)
    expect(result.order).toHaveLength(MAX_CURATED_POSTS)
    expect(result.sizes).toHaveLength(MAX_CURATED_POSTS)
    expect(result.includeLatest).toBe(true)
    expect(curateItems([...many, pack], result)).toHaveLength(126)
    expect(
      curationRecordSchema(DID).safeParse({
        $type: FRONTPAGE_COLLECTION,
        version: 1,
        ...result,
        updatedAt: '2026-07-15T12:00:00Z',
      }).success,
    ).toBe(true)
  })
})
