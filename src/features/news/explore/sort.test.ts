import {type ExploreStory} from './cluster'
import {dutchThreadSort, sortStories} from './sort'

function story(id: string, publishedAt?: string): ExploreStory {
  const section = {id: 'other', label: {id: 'other'}, terms: []}
  const lead = {
    publisher: {id: `${id}.example`, categories: []},
    item: {id, title: id, link: `https://${id}.example/`, publishedAt},
    section,
  }
  return {
    id,
    source: 'rss',
    lead,
    coverage: [lead],
    outletCount: 1,
    section,
    publishedAt,
  }
}

describe('sortStories', () => {
  const stories = [
    story('big', '2026-10-27T08:00:00Z'),
    story('undated'),
    story('fresh', '2026-10-29T08:00:00Z'),
    story('recent', '2026-10-28T08:00:00Z'),
  ]

  it('keeps the source order for top', () => {
    expect(sortStories(stories, 'top')).toBe(stories)
  })

  it('puts the newest first for latest, undated last', () => {
    expect(sortStories(stories, 'latest').map(s => s.id)).toEqual([
      'fresh',
      'recent',
      'big',
      'undated',
    ])
  })

  it('does not reorder the stories it was given', () => {
    sortStories(stories, 'latest')
    expect(stories[0].id).toBe('big')
  })
})

describe('dutchThreadSort', () => {
  it('asks the labeler for its burst ranking or its newest', () => {
    expect(dutchThreadSort('top')).toBe('burst')
    expect(dutchThreadSort('latest')).toBe('latest')
  })
})
