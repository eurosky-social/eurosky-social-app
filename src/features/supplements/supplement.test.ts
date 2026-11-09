import {describe, expect, it} from '@jest/globals'

import {type DutchArticle} from '#/features/news/dutch/types'
import {parseDids} from './config'
import {
  addArticle,
  articleFromAggregator,
  articleFromLink,
  draftProblems,
  emptyDraft,
  groupSupplements,
  localDay,
  MAX_SUPPLEMENT_ITEMS,
  moveArticle,
  removeArticle,
  type Supplement,
  SUPPLEMENT_COLLECTION,
  type SupplementArticle,
  supplementFromDraft,
  supplementRecordSchema,
  supplementStatus,
} from './supplement'

const article = (url: string): SupplementArticle => ({
  url,
  title: url,
  outlet: {name: 'Outlet'},
})

const supplement = (overrides: Partial<Supplement> = {}): Supplement => ({
  title: 'De verkiezingen',
  topic: {slug: 'elections', name: 'Elections'},
  startDate: '2026-11-01',
  items: [],
  ...overrides,
})

const record = (overrides: Partial<Supplement> = {}) => ({
  ...supplement(overrides),
  $type: SUPPLEMENT_COLLECTION,
  version: 1,
  updatedAt: '2026-11-06T12:00:00.000Z',
})

describe('supplementStatus', () => {
  const dates = {startDate: '2026-11-01', endDate: '2026-11-30'}

  it('is upcoming until its first day', () => {
    expect(supplementStatus(dates, '2026-10-31')).toBe('upcoming')
    expect(supplementStatus(dates, '2026-11-01')).toBe('current')
  })

  it('is current through its last day and archived from the day after', () => {
    expect(supplementStatus(dates, '2026-11-30')).toBe('current')
    expect(supplementStatus(dates, '2026-12-01')).toBe('archived')
  })

  it('stays current without an end date', () => {
    expect(supplementStatus({startDate: '2020-01-01'}, '2099-01-01')).toBe(
      'current',
    )
  })
})

describe('localDay', () => {
  it('is the calendar day where the reader is, zero-padded', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('groupSupplements', () => {
  const entry = (did: string, overrides: Partial<Supplement>) => ({
    did,
    supplement: supplement(overrides),
  })
  const today = '2026-11-06'
  const old = entry('did:a', {startDate: '2026-01-01', endDate: '2026-02-01'})
  const older = entry('did:a', {startDate: '2025-01-01', endDate: '2025-02-01'})
  const running = entry('did:a', {startDate: '2026-10-01'})
  const newer = entry('did:b', {startDate: '2026-11-01'})
  const mine = entry('did:me', {startDate: '2026-12-01'})
  const theirs = entry('did:a', {startDate: '2026-12-01'})
  const all = [older, old, running, newer, mine, theirs]

  it('sorts current by newest start and the archive by latest end', () => {
    const groups = groupSupplements(all, today, 'did:me')
    expect(groups.current).toEqual([newer, running])
    expect(groups.archived).toEqual([old, older])
  })

  it('shows an upcoming supplement to its editor alone', () => {
    expect(groupSupplements(all, today, 'did:me').upcoming).toEqual([mine])
    expect(groupSupplements(all, today, undefined).upcoming).toEqual([])
  })
})

describe('items', () => {
  const a = article('https://a.example/1')
  const b = article('https://b.example/2')
  const c = article('https://c.example/3')

  it('adds at the end and ignores an article it already has', () => {
    expect(addArticle([a], b)).toEqual([a, b])
    const sameWithTracking = article('https://www.a.example/1/?utm_source=x')
    expect(addArticle([a, b], sameWithTracking)).toEqual([a, b])
  })

  it('holds no more than the limit', () => {
    const full = Array.from({length: MAX_SUPPLEMENT_ITEMS}, (_, n) =>
      article(`https://a.example/${n}`),
    )
    expect(addArticle(full, b)).toBe(full)
  })

  it('removes one article', () => {
    expect(removeArticle([a, b, c], b.url)).toEqual([a, c])
  })

  it('moves one place, and not past either end', () => {
    expect(moveArticle([a, b, c], b.url, -1)).toEqual([b, a, c])
    expect(moveArticle([a, b, c], b.url, 1)).toEqual([a, c, b])
    expect(moveArticle([a, b, c], a.url, -1)).toEqual([a, b, c])
    expect(moveArticle([a, b, c], c.url, 1)).toEqual([a, b, c])
  })
})

describe('articles from their sources', () => {
  const aggregated: DutchArticle = {
    uri: 'https://www.nos.nl/artikel/1',
    title: ' De uitslag ',
    summary: 'x'.repeat(600),
    imageUrl: 'javascript:alert(1)',
    publishedAt: '2026-11-06T10:00:00.000Z',
    outlet: {slug: 'nos', did: null, name: 'NOS', country: 'nl'},
    siteUrl: null,
    province: null,
    lang: 'nl',
    labels: [],
  }

  it('keeps what a card needs from an aggregator article', () => {
    const kept = articleFromAggregator(aggregated)!
    expect(kept.title).toBe('De uitslag')
    expect(kept.summary).toHaveLength(500)
    expect(kept.outlet).toEqual({name: 'NOS', slug: 'nos'})
    expect(kept.imageUrl).toBeUndefined()
  })

  it('names the site where the aggregator names no outlet', () => {
    expect(
      articleFromAggregator({...aggregated, outlet: null})!.outlet.name,
    ).toBe('nos.nl')
  })

  it('refuses an article it could not show or open', () => {
    expect(articleFromAggregator({...aggregated, title: null})).toBeUndefined()
    expect(
      articleFromAggregator({...aggregated, uri: 'at://did:plc:x/post/1'}),
    ).toBeUndefined()
  })

  it('builds an article from a link', () => {
    expect(articleFromLink(' https://www.lemonde.fr/a ', ' Titre ')).toEqual({
      url: 'https://www.lemonde.fr/a',
      title: 'Titre',
      outlet: {name: 'lemonde.fr'},
    })
    expect(articleFromLink('javascript:alert(1)', 'Titre')).toBeUndefined()
    expect(articleFromLink('https://a.example', ' ')).toBeUndefined()
  })
})

describe('drafts', () => {
  const ready = {
    ...emptyDraft('2026-11-06'),
    title: ' De verkiezingen ',
    topic: {slug: 'elections', name: 'Elections'},
  }

  it('names what is missing before publishing', () => {
    expect(draftProblems(emptyDraft('2026-11-06'))).toEqual(['title', 'topic'])
    expect(draftProblems(ready)).toEqual([])
    expect(draftProblems({...ready, startDate: ''})).toContain('startDate')
    expect(draftProblems({...ready, endDate: '2026-11-05'})).toEqual([
      'endDate',
    ])
  })

  it('becomes a supplement only without problems', () => {
    expect(supplementFromDraft(emptyDraft('2026-11-06'))).toBeUndefined()
    expect(supplementFromDraft(ready)).toEqual({
      title: 'De verkiezingen',
      topic: ready.topic,
      startDate: '2026-11-06',
      items: [],
    })
  })

  it('allows an end date on the start date', () => {
    expect(draftProblems({...ready, endDate: ready.startDate})).toEqual([])
  })
})

describe('supplementRecordSchema', () => {
  it('reads a record', () => {
    expect(supplementRecordSchema.safeParse(record()).success).toBe(true)
  })

  it.each([
    ['an empty title', {title: '  '}],
    ['a day that does not exist', {startDate: '2026-02-31'}],
    ['an end before the start', {endDate: '2026-10-31'}],
    [
      'an article that is not on the web',
      {items: [article('javascript:alert(1)')]},
    ],
    [
      'an image that is not on the web',
      {
        items: [
          {...article('https://a.example'), imageUrl: 'data:text/html,x'},
        ],
      },
    ],
    [
      'the same article twice',
      {
        items: [
          article('https://a.example/1'),
          article('https://a.example/1/'),
        ],
      },
    ],
  ])('refuses %s', (_, overrides) => {
    expect(supplementRecordSchema.safeParse(record(overrides)).success).toBe(
      false,
    )
  })

  it('refuses a version it does not know', () => {
    expect(
      supplementRecordSchema.safeParse({...record(), version: 2}).success,
    ).toBe(false)
  })
})

describe('parseDids', () => {
  it('reads DIDs, once each, and skips anything else', () => {
    expect(parseDids('did:plc:a, did:web:b.example\nnos did:plc:a')).toEqual([
      'did:plc:a',
      'did:web:b.example',
    ])
    expect(parseDids(undefined)).toEqual([])
  })
})
