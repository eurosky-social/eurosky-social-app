import {describe, expect, it} from '@jest/globals'

import {EXPLORE_SECTION_OTHER, type ExploreSection} from '../explore/sections'
import {adaptStory, outletFor, themeSections} from './adapt'
import {type DutchArticle, type DutchStory, type DutchTheme} from './types'

const SPORT: ExploreSection = {id: 'sport', label: {id: 'sport'}, terms: []}

const sectionForTheme = (theme: string | null) =>
  theme === 'sport' ? SPORT : EXPLORE_SECTION_OTHER

function article(overrides: Partial<DutchArticle> = {}): DutchArticle {
  return {
    uri: 'https://nos.nl/artikel/1',
    title: 'Een kop',
    summary: 'Een samenvatting',
    imageUrl: 'https://nos.nl/image.jpg',
    publishedAt: '2026-09-20T08:00:00Z',
    outlet: 'NOS',
    siteUrl: 'https://www.nos.nl',
    province: null,
    labels: ['dutch'],
    similarity: 0.9,
    ...overrides,
  }
}

function story(overrides: Partial<DutchStory> = {}): DutchStory {
  return {
    id: 42,
    name: 'kop, verhaal',
    terms: ['kop', 'verhaal'],
    headline: 'Een kop',
    kind: 'story',
    theme: 'sport',
    counts: {posts: 12, articles: 5, outlets: 4},
    provinces: {},
    firstSeen: '2026-09-19T08:00:00Z',
    lastSeen: '2026-09-20T08:00:00Z',
    lead: article(),
    articles: [],
    posts: [],
    ...overrides,
  }
}

describe('adaptStory', () => {
  it('drops a story whose articles have aged out of the archive', () => {
    expect(adaptStory(story({lead: null}), sectionForTheme)).toBeUndefined()
  })

  it('files the story under the section its theme maps to', () => {
    const adapted = adaptStory(story(), sectionForTheme)
    expect(adapted?.section).toBe(SPORT)
  })

  it('falls back to More stories when the theme matches no section', () => {
    const adapted = adaptStory(story({theme: null}), sectionForTheme)
    expect(adapted?.section).toBe(EXPLORE_SECTION_OTHER)
  })

  it('leads the coverage with the lead article', () => {
    const adapted = adaptStory(
      story({
        articles: [article({uri: 'https://nu.nl/2', outlet: 'NU.nl'})],
      }),
      sectionForTheme,
    )
    expect(adapted?.coverage.map(a => a.item.link)).toEqual([
      'https://nos.nl/artikel/1',
      'https://nu.nl/2',
    ])
    expect(adapted?.lead.item.link).toBe('https://nos.nl/artikel/1')
  })

  /*
   * The API returns at most three further articles but counts outlets across
   * all of them, so the count must not be re-derived from `coverage`.
   */
  it('takes the newsroom count from the API, not from the returned articles', () => {
    const adapted = adaptStory(story(), sectionForTheme)
    expect(adapted?.coverage).toHaveLength(1)
    expect(adapted?.newsroomCount).toBe(4)
  })

  it('carries the matched discussion count', () => {
    expect(adaptStory(story(), sectionForTheme)?.postCount).toBe(12)
  })

  it('ranks provinces by volume, ties alphabetical, empties dropped', () => {
    const adapted = adaptStory(
      story({
        provinces: {'nl-utrecht': 2, 'nl-drenthe': 9, 'nl-zeeland': 0},
      }),
      sectionForTheme,
    )
    expect(adapted?.provinces).toEqual(['nl-drenthe', 'nl-utrecht'])
  })

  it('maps article fields onto the shape a story card reads', () => {
    const adapted = adaptStory(story(), sectionForTheme)
    expect(adapted?.lead.item).toEqual({
      id: 'https://nos.nl/artikel/1',
      title: 'Een kop',
      link: 'https://nos.nl/artikel/1',
      publishedAt: '2026-09-20T08:00:00Z',
      description: 'Een samenvatting',
      imageUrl: 'https://nos.nl/image.jpg',
      categories: ['dutch'],
    })
  })

  it('tolerates an article with no title, summary or image', () => {
    const adapted = adaptStory(
      story({lead: article({title: null, summary: null, imageUrl: null})}),
      sectionForTheme,
    )
    expect(adapted?.lead.item.title).toBe('')
    expect(adapted?.lead.item.description).toBeUndefined()
    expect(adapted?.lead.item.imageUrl).toBeUndefined()
  })
})

describe('outletFor', () => {
  it('keys an outlet on its site host so one site is one newsroom', () => {
    const a = outletFor(article({siteUrl: 'https://www.nos.nl'}))
    const b = outletFor(
      article({uri: 'https://nos.nl/artikel/2', siteUrl: 'https://nos.nl'}),
    )
    expect(a.id).toBe('nos.nl')
    expect(b.id).toBe(a.id)
  })

  it('falls back to the article host when the outlet has no site url', () => {
    const outlet = outletFor(
      article({siteUrl: null, uri: 'https://www.rtvdrenthe.nl/nieuws/1'}),
    )
    expect(outlet.id).toBe('rtvdrenthe.nl')
  })

  it('falls back to the outlet name when nothing parses as a url', () => {
    const outlet = outletFor(article({siteUrl: null, uri: 'not a url'}))
    expect(outlet.id).toBe('NOS')
  })

  it('carries a regional outlet province as a section hint', () => {
    expect(outletFor(article({province: 'nl-drenthe'})).categories).toEqual([
      'nl-drenthe',
    ])
  })

  it('has no did, since most ingested outlets have no bluesky account', () => {
    expect(outletFor(article()).did).toBeUndefined()
  })
})

describe('themeSections', () => {
  function theme(overrides: Partial<DutchTheme> = {}): DutchTheme {
    return {
      slug: 'sport',
      name: 'Sport',
      nameNl: 'Sport',
      description: null,
      counts: {stories: 3, recurring: 0, posts: 9, articles: 12},
      ...overrides,
    }
  }

  it('builds sections from the served themes, in the API order', () => {
    const sections = themeSections([
      theme(),
      theme({slug: 'politics', name: 'Politics'}),
    ])
    expect(sections.map(s => s.id)).toEqual(['sport', 'politics'])
  })

  /*
   * Sectioning here is the theme assignment, not keyword matching, so the
   * terms that drive `sectionForArticle` must stay empty.
   */
  it('carries no match terms', () => {
    expect(themeSections([theme()])[0].terms).toEqual([])
  })
})
