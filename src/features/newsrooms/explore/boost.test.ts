import {type NewsFeedPrefs} from '#/features/newsFeed/state/prefs'
import {boostStories, interestsFromPrefs} from './boost'
import {type ExploreStory} from './cluster'

function prefs(overrides: Partial<NewsFeedPrefs> = {}): NewsFeedPrefs {
  return {
    topics: ['all'],
    regions: [],
    languages: [],
    excludedDids: [],
    interests: [],
    createdAt: '2026-10-06T00:00:00.000Z',
    ...overrides,
  }
}

function story(
  id: string,
  {
    section = 'other',
    site = `${id}.example`,
    regions,
    labels,
  }: {
    section?: string
    site?: string
    regions?: string[]
    labels?: string[]
  } = {},
): ExploreStory {
  const section_ = {id: section, label: {id: section}, terms: []}
  const lead = {
    publisher: {id: site, site, categories: []},
    item: {
      id,
      title: id,
      link: `https://${site}/${id}`,
      categories: labels,
    },
    section: section_,
  }
  return {
    id,
    source: 'dutch',
    lead,
    coverage: [lead],
    newsroomCount: 1,
    section: section_,
    regions,
  }
}

/** Unremarkable stories, so a boosted one has somewhere to rise from. */
function filler(count: number): ExploreStory[] {
  return Array.from({length: count}, (_, index) => story(`filler-${index}`))
}

const ids = (stories: ExploreStory[]) => stories.map(s => s.id)

describe('interestsFromPrefs', () => {
  it('is undefined without settings', () => {
    expect(interestsFromPrefs(null)).toBeUndefined()
    expect(interestsFromPrefs(prefs({topics: []}))).toBeUndefined()
  })

  it('takes the topics as sections, with the regions’ own', () => {
    const interests = interestsFromPrefs(
      prefs({topics: ['sport', 'climate'], regions: ['global']}),
    )
    expect([...interests!.sectionIds].sort()).toEqual([
      'climate',
      'sport',
      'world',
    ])
  })

  it('boosts no section for every topic', () => {
    expect([...interestsFromPrefs(prefs())!.sectionIds]).toEqual([])
  })

  it('leaves out accounts the reader excluded', () => {
    const interests = interestsFromPrefs(
      prefs({regions: ['netherlands'], excludedDids: []}),
    )
    expect(interests!.outlets.has('nu.nl')).toBe(true)

    const excluded = [...interests!.outlets].find(value =>
      value.startsWith('did:'),
    )
    const without = interestsFromPrefs(
      prefs({regions: ['netherlands'], excludedDids: [excluded!]}),
    )
    expect(without!.outlets.has(excluded!)).toBe(false)
  })
})

describe('boostStories', () => {
  it('leaves the order alone without interests', () => {
    const stories = filler(3)
    expect(boostStories(stories, undefined)).toBe(stories)
  })

  it('moves a story in a chosen topic up', () => {
    const stories = [...filler(10), story('match', {section: 'sport'})]
    const boosted = boostStories(
      stories,
      interestsFromPrefs(prefs({topics: ['sport']})),
    )
    expect(ids(boosted).indexOf('match')).toBe(2)
  })

  it('matches an outlet by its account’s domain, subdomains included', () => {
    const stories = [...filler(10), story('match', {site: 'www2.nu.nl'})]
    const boosted = boostStories(
      stories,
      interestsFromPrefs(prefs({regions: ['netherlands']})),
    )
    expect(ids(boosted).indexOf('match')).toBe(2)
  })

  it('matches the Netherlands on the labeler’s labels', () => {
    const stories = [
      ...filler(10),
      story('province', {regions: ['nl-utrecht']}),
      story('language', {labels: ['dutch']}),
    ]
    const boosted = boostStories(
      stories,
      interestsFromPrefs(prefs({regions: ['netherlands']})),
    )
    expect(ids(boosted).slice(2, 5)).toEqual([
      'province',
      'filler-2',
      'language',
    ])
  })

  it('matches a picked province, and only that province', () => {
    const stories = [
      ...filler(10),
      story('elsewhere', {regions: ['nl-zeeland']}),
      story('utrecht', {regions: ['nl-utrecht']}),
    ]
    const boosted = boostStories(
      stories,
      interestsFromPrefs(prefs({regions: ['nl-utrecht']})),
    )
    expect(ids(boosted).indexOf('utrecht')).toBe(3)
    expect(ids(boosted).indexOf('elsewhere')).toBe(11)
  })

  it('counts each kind of interest once, and adds them up', () => {
    const stories = [
      ...filler(20),
      story('both', {section: 'politics', regions: ['nl-utrecht']}),
    ]
    const boosted = boostStories(
      stories,
      interestsFromPrefs(
        prefs({topics: ['politics'], regions: ['netherlands']}),
      ),
    )
    expect(ids(boosted).indexOf('both')).toBe(4)
  })
})
