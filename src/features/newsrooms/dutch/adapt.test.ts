import {describe, expect, it} from '@jest/globals'

import {EXPLORE_SECTION_OTHER, type ExploreSection} from '../explore/sections'
import {
  adaptThread,
  outletFor,
  parseThreadStoryId,
  themeSections,
} from './adapt'
import {type DutchArticle, type DutchTheme, type DutchThread} from './types'

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
    outlet: {slug: 'nos', did: null, name: 'NOS', country: 'nl'},
    siteUrl: 'https://www.nos.nl',
    province: null,
    lang: 'nl',
    labels: ['dutch'],
    ...overrides,
  }
}

function thread(overrides: Partial<DutchThread> = {}): DutchThread {
  return {
    id: 42,
    key: '96a4cb3c35b7',
    scope: 'all',
    headline: 'Een kop',
    kind: 'story',
    theme: 'sport',
    counts: {events: 1, posts: 12, articles: 5, outlets: 4},
    provinces: {},
    countries: ['nl', 'be'],
    languages: ['nl', 'fr'],
    firstSeen: '2026-09-19T08:00:00Z',
    lastSeen: '2026-09-20T08:00:00Z',
    lead: article(),
    events: [],
    ...overrides,
  }
}

describe('adaptThread', () => {
  it('drops a thread whose articles have aged out of the archive', () => {
    expect(adaptThread(thread({lead: null}), sectionForTheme)).toBeUndefined()
  })

  it('files the story under the section its theme maps to', () => {
    const adapted = adaptThread(thread(), sectionForTheme)
    expect(adapted?.section).toBe(SPORT)
  })

  it('falls back to More stories when the theme matches no section', () => {
    const adapted = adaptThread(thread({theme: null}), sectionForTheme)
    expect(adapted?.section).toBe(EXPLORE_SECTION_OTHER)
  })

  it('leads the coverage with the lead, then each event’s articles once', () => {
    const adapted = adaptThread(
      thread({
        events: [
          {
            key: 'e1',
            day: '2026-09-20',
            lead: article(),
            articles: [article({uri: 'https://nu.nl/2'})],
          },
          {
            key: 'e2',
            day: '2026-09-19',
            lead: article({uri: 'https://lesoir.be/3'}),
            articles: [article({uri: 'https://nu.nl/2'})],
          },
        ],
      }),
      sectionForTheme,
    )
    expect(adapted?.coverage.map(a => a.item.link)).toEqual([
      'https://nos.nl/artikel/1',
      'https://nu.nl/2',
      'https://lesoir.be/3',
    ])
    expect(adapted?.lead.item.link).toBe('https://nos.nl/artikel/1')
  })

  /*
   * The API returns a few articles per event but counts outlets across all
   * of them, so the count must not be re-derived from `coverage`.
   */
  it('leads with the lead the service picked in the languages', () => {
    const adapted = adaptThread(
      thread({leadIn: article({uri: 'https://bbc.co.uk/1', lang: 'en'})}),
      sectionForTheme,
    )
    expect(adapted?.lead.item.link).toBe('https://bbc.co.uk/1')
    expect(adapted?.coverage.map(a => a.item.link)).toEqual([
      'https://bbc.co.uk/1',
      'https://nos.nl/artikel/1',
    ])
  })

  it('keeps the thread’s lead when the service picked none', () => {
    const adapted = adaptThread(thread({leadIn: null}), sectionForTheme)
    expect(adapted?.lead.item.link).toBe('https://nos.nl/artikel/1')
  })

  it('puts boosted outlets’ articles first after the lead', () => {
    const adapted = adaptThread(
      thread({
        events: [
          {
            key: 'e1',
            day: '2026-09-20',
            lead: article({uri: 'https://nu.nl/1', boosted: false}),
            articles: [article({uri: 'https://hln.be/2', boosted: true})],
          },
          {
            key: 'e2',
            day: '2026-09-19',
            lead: article({uri: 'https://lesoir.be/3', boosted: true}),
            articles: [article({uri: 'https://ad.nl/4', boosted: false})],
          },
        ],
      }),
      sectionForTheme,
    )
    expect(adapted?.coverage.map(a => a.item.link)).toEqual([
      'https://nos.nl/artikel/1',
      'https://hln.be/2',
      'https://lesoir.be/3',
      'https://nu.nl/1',
      'https://ad.nl/4',
    ])
  })

  it('carries the view the thread was read in', () => {
    expect(adaptThread(thread(), sectionForTheme, 'lang=en')?.view).toBe(
      'lang=en',
    )
  })

  it('takes the newsroom count from the API, not from the returned articles', () => {
    const adapted = adaptThread(thread(), sectionForTheme)
    expect(adapted?.coverage).toHaveLength(1)
    expect(adapted?.newsroomCount).toBe(4)
  })

  it('carries the discussion count and the covering countries', () => {
    const adapted = adaptThread(thread(), sectionForTheme)
    expect(adapted?.postCount).toBe(12)
    expect(adapted?.countries).toEqual(['nl', 'be'])
  })

  it('ranks provinces by volume, ties alphabetical, empties dropped', () => {
    const adapted = adaptThread(
      thread({
        provinces: {'nl-utrecht': 2, 'nl-drenthe': 9, 'nl-zeeland': 0},
      }),
      sectionForTheme,
    )
    expect(adapted?.provinces).toEqual(['nl-drenthe', 'nl-utrecht'])
  })

  it('names the story by scope and key, which outlive a refit', () => {
    const adapted = adaptThread(thread(), sectionForTheme)
    expect(adapted?.id).toBe('all:96a4cb3c35b7')
    expect(parseThreadStoryId(adapted!.id)).toEqual({
      scope: 'all',
      key: '96a4cb3c35b7',
    })
  })

  it('maps article fields onto the shape a story card reads', () => {
    const adapted = adaptThread(thread(), sectionForTheme)
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
    const adapted = adaptThread(
      thread({lead: article({title: null, summary: null, imageUrl: null})}),
      sectionForTheme,
    )
    expect(adapted?.lead.item.title).toBe('')
    expect(adapted?.lead.item.description).toBeUndefined()
    expect(adapted?.lead.item.imageUrl).toBeUndefined()
  })
})

describe('parseThreadStoryId', () => {
  it('is undefined for an id this adapter did not build', () => {
    expect(parseThreadStoryId('42')).toBeUndefined()
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

  it('falls back to the outlet slug when nothing parses as a url', () => {
    const outlet = outletFor(article({siteUrl: null, uri: 'not a url'}))
    expect(outlet.id).toBe('nos')
  })

  it('carries a regional outlet province as a section hint', () => {
    expect(outletFor(article({province: 'nl-drenthe'})).categories).toEqual([
      'nl-drenthe',
    ])
  })

  it('carries the outlet’s account where the service knows it', () => {
    expect(outletFor(article()).did).toBeUndefined()
    const did = 'did:plc:esuprtqiivckuufea5jclh77'
    expect(
      outletFor(
        article({
          outlet: {slug: 'rtl-nieuws', did, name: 'RTL Nieuws', country: 'nl'},
        }),
      ).did,
    ).toBe(did)
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
