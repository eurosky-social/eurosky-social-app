import {describe, expect, it} from '@jest/globals'

import {
  addSection,
  articleSize,
  type Curation,
  curationRecordSchema,
  DEFAULT_SECTION_LENGTH,
  defaultCuration,
  endsWithOwnPosts,
  fillFeeds,
  fromLegacyRecord,
  fromSlotsRecord,
  FRONTPAGE_COLLECTION,
  type FrontpageSection,
  isAllowedSlotUri,
  isOwnPostUri,
  layoutSections,
  legacyRecordSchema,
  MAX_SECTION_LENGTH,
  moveSection,
  ownRoom,
  pinStory,
  placeStory,
  removeSection,
  setArticleSize,
  setSectionFill,
  setSectionKind,
  setSectionLength,
  setStarterPackView,
  slotsRecordSchema,
  splitSection,
  starterPackView,
  unpinStory,
  updateSection,
} from './curation'

const DID = 'did:plc:y57igqldvutzs7gpmmrrqbw7'
const uri = (id: string) => `at://${DID}/app.bsky.feed.post/${id}`
const feed = `at://${DID}/app.bsky.feed.generator/news`
type Story = {item: {uri: string}; url?: string}
const story = (id: string): Story => ({item: {uri: uri(id)}})
/** The account's posts, newest first. */
const posts = ['a', 'b', 'c', 'd', 'e', 'f'].map(story)
/** Another account's posts, from a feed. */
const fromFeed = ['x', 'y', 'z'].map(id => ({
  item: {uri: `at://did:plc:other/app.bsky.feed.post/${id}`},
}))

function page(...sections: Partial<FrontpageSection>[]): Curation {
  return {
    cover: false,
    sections: sections.map((section, index) => ({
      id: `s${index}`,
      fill: 'own',
      pinned: [],
      length: 4,
      ...section,
    })),
  }
}
/** Each section's stories, by their ids. */
function shown(curation: Curation, own: Story[] = posts) {
  return layoutSections(
    {own, resources: [], feeds: {[feed]: fromFeed}},
    curation,
  ).map(({slots}) => slots.map(slot => slot.story.item.uri.split('/').pop()))
}
function record(curation: Curation) {
  return {
    $type: FRONTPAGE_COLLECTION,
    version: 3,
    ...curation,
    updatedAt: '2026-10-29T12:00:00Z',
  }
}

describe('a page nobody has arranged', () => {
  it('has the cover and one infinite section of the newest posts', () => {
    const curation = defaultCuration()
    expect(curation.cover).toBe(true)
    expect(curation.sections).toEqual([
      {id: 'main', fill: 'own', pinned: [], length: 'infinite'},
    ])
    expect(shown(curation)).toEqual([['a', 'b', 'c', 'd', 'e', 'f']])
    expect(ownRoom(curation)).toBe(0)
    expect(endsWithOwnPosts(curation)).toBe(true)
  })
})

describe('sections as containers', () => {
  it('shows pinned stories first, then fills the room left, section by section', () => {
    const curation = page({pinned: [uri('e')], length: 3}, {length: 2})
    expect(shown(curation)).toEqual([
      ['e', 'a', 'b'],
      ['c', 'd'],
    ])
  })

  it('collapses room when there is nothing left to fill it', () => {
    expect(shown(page({length: 4}, {length: 4}))).toEqual([
      ['a', 'b', 'c', 'd'],
      ['e', 'f'],
    ])
  })

  it('shows only pinned stories in a section that does not fill', () => {
    const curation = page({fill: 'none', pinned: [uri('d')]}, {length: 2})
    expect(shown(curation)).toEqual([['d'], ['a', 'b']])
  })

  it('fills from a feed, without repeating what another section shows', () => {
    const curation = page(
      {fill: {feed}, length: 2},
      {fill: {feed}, length: 2},
      {length: 1},
    )
    expect(shown(curation)).toEqual([['x', 'y'], ['z'], ['a']])
    expect(fillFeeds(curation)).toEqual([feed])
  })

  it('skips a pinned story that is gone', () => {
    expect(shown(page({pinned: [uri('gone'), uri('b')], length: 3}))).toEqual([
      ['b', 'a', 'c'],
    ])
  })

  it('lets a pinned link win over an automatic copy of it', () => {
    const own = [
      {
        item: {uri: uri('new')},
        url: 'https://www.wired.com/story/x/?utm_source=bluesky',
      },
      {item: {uri: uri('old')}, url: 'https://wired.com/story/x'},
    ]
    expect(shown(page({pinned: [uri('old')]}), own)).toEqual([['old']])
  })
})

describe('pinning and placing stories', () => {
  it('pins a story at the end of the section’s pinned stories', () => {
    const next = pinStory(page({pinned: [uri('a')]}), 's0', uri('d'))
    expect(next.sections[0].pinned).toEqual([uri('a'), uri('d')])
    expect(shown(next)).toEqual([['a', 'd', 'b', 'c']])
  })

  it('places a story exactly among the pinned ones', () => {
    const next = placeStory(
      page({pinned: [uri('a'), uri('b')]}),
      uri('e'),
      's0',
      1,
    )
    expect(next.sections[0].pinned).toEqual([uri('a'), uri('e'), uri('b')])
  })

  it('places a story dropped among automatic ones at the end of the pinned ones', () => {
    const next = placeStory(page({pinned: [uri('a')]}), uri('f'), 's0', 3)
    expect(next.sections[0].pinned).toEqual([uri('a'), uri('f')])
    expect(next.sections[0].length).toBe(4)
  })

  it('moves a story within its section', () => {
    const next = placeStory(
      page({pinned: [uri('a'), uri('b'), uri('c')]}),
      uri('a'),
      's0',
      3,
    )
    expect(next.sections[0].pinned).toEqual([uri('b'), uri('c'), uri('a')])
  })

  it('moves a story from another section, leaving its room to the fill', () => {
    const next = placeStory(
      page({pinned: [uri('f')], length: 2}, {length: 2}),
      uri('f'),
      's1',
      0,
    )
    expect(next.sections.map(({pinned, length}) => ({pinned, length}))).toEqual(
      [
        {pinned: [], length: 2},
        {pinned: [uri('f')], length: 2},
      ],
    )
  })

  it('grows a section only when its pinned stories outgrow it', () => {
    const next = placeStory(
      page({pinned: [uri('a'), uri('b')], length: 2}),
      uri('c'),
      's0',
      2,
    )
    expect(next.sections[0]).toMatchObject({length: 3})
  })

  it('refuses a section that is not on the page', () => {
    expect(() => placeStory(page({}), feed, 'nope', 0)).toThrow(
      'InsertionPointUnavailable',
    )
  })

  it('unpins a post back into the automatic ones, and removes a feed', () => {
    const curation = page({pinned: [uri('f'), feed], length: 3})
    expect(unpinStory(curation, uri('f')).sections[0].pinned).toEqual([feed])
    /* The feed is not loaded here, so its room goes to automatic posts. */
    expect(shown(unpinStory(curation, uri('f')))).toEqual([['a', 'b', 'c']])
    expect(unpinStory(curation, feed).sections[0].pinned).toEqual([uri('f')])
  })

  it('keeps feeds and starter packs out of a carousel', () => {
    const carousel = page({kind: 'carousel'})
    expect(() => placeStory(carousel, feed, 's0', 0)).toThrow(
      'CarouselTakesPosts',
    )
    expect(
      setSectionKind(page({pinned: [uri('a'), feed]}), 's0', 'carousel')
        .sections[0],
    ).toMatchObject({kind: 'carousel', pinned: [uri('a')]})
  })

  it('does not change the layout it was given', () => {
    const curation = Object.freeze(page({}))
    placeStory(curation, uri('a'), 's0', 0)
    expect(curation.sections[0].pinned).toEqual([])
  })
})

describe('splitting a section', () => {
  it('splits among automatic stories, keeping every story where it was', () => {
    const curation = page({pinned: [uri('f')], length: 5, title: 'News'})
    const next = splitSection(curation, 's0', 3)
    expect(next.sections).toHaveLength(2)
    expect(next.sections[0]).toMatchObject({
      title: 'News',
      pinned: [uri('f')],
      length: 3,
    })
    expect(next.sections[1]).toMatchObject({
      fill: 'own',
      pinned: [],
      length: 2,
    })
    expect(next.sections[1].title).toBeUndefined()
    expect(shown(next)).toEqual([
      ['f', 'a', 'b'],
      ['c', 'd'],
    ])
  })

  it('splits among pinned stories, moving the rest of them along', () => {
    const curation = page({pinned: [uri('e'), uri('f')], length: 4})
    const next = splitSection(curation, 's0', 1, uri('f'))
    expect(next.sections.map(({pinned, length}) => ({pinned, length}))).toEqual(
      [
        {pinned: [uri('e')], length: 1},
        {pinned: [uri('f')], length: 3},
      ],
    )
    expect(shown(next)).toEqual([['e'], ['f', 'a', 'b']])
  })

  it('keeps the rest infinite when splitting an infinite section', () => {
    const next = splitSection(defaultCuration(), 'main', 2)
    expect(next.sections.map(section => section.length)).toEqual([
      2,
      'infinite',
    ])
    expect(shown(next)).toEqual([
      ['a', 'b'],
      ['c', 'd', 'e', 'f'],
    ])
  })

  it('does nothing at the top or bottom of a section', () => {
    const curation = page({length: 3})
    expect(splitSection(curation, 's0', 0).sections).toHaveLength(1)
    expect(splitSection(curation, 's0', 3).sections).toHaveLength(1)
  })
})

describe('section settings', () => {
  it('changes a section’s length, never below what it pins', () => {
    const curation = page({pinned: [uri('a'), uri('b')]})
    expect(setSectionLength(curation, 's0', 9).sections[0].length).toBe(9)
    expect(setSectionLength(curation, 's0', 1).sections[0].length).toBe(2)
    expect(setSectionLength(curation, 's0', 999).sections[0].length).toBe(
      MAX_SECTION_LENGTH,
    )
  })

  it('lets only the last section be infinite', () => {
    const curation = page({}, {})
    expect(
      setSectionLength(curation, 's1', 'infinite').sections[1].length,
    ).toBe('infinite')
    expect(
      setSectionLength(curation, 's0', 'infinite').sections[0].length,
    ).toBe(4)
    const added = addSection(defaultCuration(), 'main', {})
    expect(added.sections[0].length).toBe(DEFAULT_SECTION_LENGTH)
  })

  it('adds, renames, refills, moves and removes sections, keeping one', () => {
    let curation = addSection(page({}), 's0', {title: 'Politics'})
    const added = curation.sections[1]
    expect(added).toMatchObject({title: 'Politics', fill: 'own'})
    curation = updateSection(curation, added.id, {title: 'World'})
    curation = setSectionFill(curation, added.id, {feed})
    expect(curation.sections[1]).toMatchObject({title: 'World', fill: {feed}})
    curation = moveSection(curation, added.id, -1)
    expect(curation.sections.map(section => section.id)).toEqual([
      added.id,
      's0',
    ])
    curation = removeSection(curation, added.id)
    expect(curation.sections.map(section => section.id)).toEqual(['s0'])
    expect(removeSection(curation, 's0')).toBe(curation)
  })
})

describe('story sizes', () => {
  it('varies unsized stories by their place, and never makes the lead small', () => {
    const curation = defaultCuration()
    expect(articleSize(curation, uri('a'), true, 0)).toBe('medium')
    expect(articleSize(curation, uri('b'), false, 1)).toBe('small')
    expect(articleSize(curation, uri('f'), false, 5)).toBe('big')
    const sized = setArticleSize(curation, uri('a'), 'small')
    expect(articleSize(sized, uri('a'), true, 0)).toBe('medium')
    expect(articleSize(sized, uri('a'), false, 5)).toBe('small')
  })

  it('keeps a starter pack’s display choice per slot', () => {
    const pack = `at://${DID}/app.bsky.graph.starterpack/start`
    const curation = setStarterPackView(defaultCuration(), pack, 'posts')
    expect(starterPackView(curation, pack)).toBe('posts')
    expect(starterPackView(defaultCuration(), pack)).toBe('people')
  })
})

describe('published records', () => {
  const schema = curationRecordSchema(DID)

  it('accepts the default page and arranged sections', () => {
    expect(schema.safeParse(record(defaultCuration())).success).toBe(true)
    expect(
      schema.safeParse(
        record(
          page(
            {title: 'Politics', pinned: [uri('a'), feed]},
            {fill: {feed}, kind: 'carousel', pinned: [uri('b')]},
            {fill: 'none', pinned: [uri('c')], length: 1},
          ),
        ),
      ).success,
    ).toBe(true)
  })

  it.each([
    ['a post pinned twice', page({pinned: [uri('a')]}, {pinned: [uri('a')]})],
    [
      'another account’s post',
      page({pinned: ['at://did:plc:other/app.bsky.feed.post/x']}),
    ],
    ['no sections', page()],
    ['a section that is too long', page({length: MAX_SECTION_LENGTH + 1})],
    ['more pinned than room', page({pinned: [uri('a'), uri('b')], length: 1})],
    ['a feed in a carousel', page({kind: 'carousel', pinned: [feed]})],
    ['a fill that is not a feed', page({fill: {feed: uri('a')}})],
    ['a malformed id', page({id: 'Not An Id'})],
    ['an infinite section before the last', page({length: 'infinite'}, {})],
    ['a blank title', page({title: '  '})],
  ])('rejects %s', (_, curation) => {
    expect(schema.safeParse(record(curation)).success).toBe(false)
  })

  it('rejects other versions', () => {
    expect(
      schema.safeParse({...record(defaultCuration()), version: 4}).success,
    ).toBe(false)
  })

  it('accepts only post URIs owned by this repository', () => {
    expect(isOwnPostUri(uri('a'), DID)).toBe(true)
    expect(isOwnPostUri(`${uri('a')}/extra`, DID)).toBe(false)
    expect(isOwnPostUri('at://did:plc:other/app.bsky.feed.post/a', DID)).toBe(
      false,
    )
    expect(isAllowedSlotUri(feed, DID)).toBe(true)
    expect(
      isAllowedSlotUri('at://did:plc:other/app.bsky.feed.generator/x', DID),
    ).toBe(true)
    expect(
      isAllowedSlotUri('at://did:plc:other/app.bsky.graph.list/x', DID),
    ).toBe(false)
  })
})

describe('earlier record shapes', () => {
  it('reads slots as pinned-first sections of the same length', () => {
    const curation = fromSlotsRecord(
      slotsRecordSchema(DID).parse({
        $type: FRONTPAGE_COLLECTION,
        version: 2,
        cover: true,
        sections: [
          {id: 'main', fill: true, slots: [null, uri('a'), null]},
          {id: 'more', kind: 'carousel', fill: false, slots: [feed, uri('b')]},
        ],
      }),
    )
    expect(curation.sections).toMatchObject([
      {id: 'main', fill: 'own', pinned: [uri('a')], length: 3},
      {id: 'more', kind: 'carousel', fill: 'none', pinned: [uri('b')]},
    ])
  })

  function legacy(value: object) {
    return legacyRecordSchema(DID).parse({
      $type: FRONTPAGE_COLLECTION,
      version: 1,
      order: [],
      hidden: [],
      includeLatest: true,
      ...value,
    })
  }

  it('turns the first shape’s stories before any header into a first section that fills', () => {
    const curation = fromLegacyRecord(legacy({order: [uri('a'), uri('b')]}))
    expect(curation.cover).toBe(false)
    expect(curation.sections).toEqual([
      {
        id: 'main',
        fill: 'own',
        pinned: [uri('a'), uri('b')],
        length: 'infinite',
      },
    ])
  })

  it('keeps the first shape’s headers as sections and fills the one new posts went to', () => {
    const curation = fromLegacyRecord(
      legacy({
        order: [uri('a'), 'section:politics', uri('b')],
        sections: [{id: 'politics', title: 'Politics'}],
        latestSection: 'politics',
      }),
    )
    expect(curation.sections).toMatchObject([
      {id: 'main', fill: 'none', pinned: [uri('a')], length: 1},
      {
        id: 'politics',
        title: 'Politics',
        fill: 'own',
        pinned: [uri('b')],
        length: 'infinite',
      },
    ])
  })

  it('fills nothing when the first shape had new posts turned off', () => {
    expect(
      fromLegacyRecord(legacy({order: [uri('a')], includeLatest: false}))
        .sections,
    ).toEqual([{id: 'main', fill: 'none', pinned: [uri('a')], length: 1}])
  })
})
