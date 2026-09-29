import {type NewsroomPublisher} from '../publishers'
import {type RssItem} from '../rss/types'
import {sectionForArticle} from './sections'

const PUBLISHER: NewsroomPublisher = {
  id: 'test',
  did: 'did:plc:test',
  domains: ['test.example'],
  categories: ['Investigations'],
  reporterDids: [],
  sources: [],
}

function article(overrides: Partial<RssItem>): RssItem {
  return {
    id: 'id',
    title: 'A headline',
    link: 'https://test.example/story',
    ...overrides,
  }
}

describe('sectionForArticle', () => {
  it("reads the publisher's own category label first", () => {
    const section = sectionForArticle(
      article({
        categories: ['US Politics'],
        link: 'https://test.example/tech/x',
      }),
      PUBLISHER,
    )
    expect(section.id).toBe('politics')
  })

  it('falls back to the URL path when the item carries no categories', () => {
    const section = sectionForArticle(
      article({link: 'https://test.example/2026/09/culture/film-review'}),
      PUBLISHER,
    )
    expect(section.id).toBe('culture')
  })

  it("falls back to the publisher's registry categories", () => {
    const section = sectionForArticle(
      article({link: 'https://test.example/a/b'}),
      PUBLISHER,
    )
    expect(section.id).toBe('investigations')
  })

  it('lands unmatched articles in "More stories" rather than guessing', () => {
    const section = sectionForArticle(
      article({link: 'https://test.example/x'}),
      {
        ...PUBLISHER,
        categories: [],
      },
    )
    expect(section.id).toBe('other')
  })

  it('matches multi-word labels on either the whole label or its parts', () => {
    expect(
      sectionForArticle(article({categories: ['Life & Arts']}), PUBLISHER).id,
    ).toBe('culture')
    expect(
      sectionForArticle(article({categories: ['Middle East']}), PUBLISHER).id,
    ).toBe('world')
  })
})
