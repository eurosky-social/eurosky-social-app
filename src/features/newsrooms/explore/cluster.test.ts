import {type NewsroomPublisher} from '../publishers'
import {type RssItem} from '../rss/types'
import {clusterArticles, groupStoriesBySection} from './cluster'
import {EXPLORE_SECTIONS} from './sections'

function publisher(id: string): NewsroomPublisher {
  return {
    id,
    did: `did:plc:${id}`,
    domains: [`${id}.example`],
    categories: [],
    reporterDids: [],
    sources: [],
  }
}

function article(title: string, overrides: Partial<RssItem> = {}): RssItem {
  return {
    id: overrides.link ?? title,
    title,
    link: overrides.link ?? `https://example.com/${encodeURIComponent(title)}`,
    publishedAt: '2026-09-07T10:00:00.000Z',
    ...overrides,
  }
}

describe('clusterArticles', () => {
  it('collapses the same event across newsrooms into one story', () => {
    const stories = clusterArticles([
      {
        publisher: publisher('alpha'),
        articles: [
          article('EU ministers agree emergency gas storage targets', {
            link: 'https://alpha.example/world/gas-storage',
          }),
        ],
      },
      {
        publisher: publisher('beta'),
        articles: [
          article(
            'Ministers agree emergency targets for European gas storage',
            {
              link: 'https://beta.example/world/storage-deal',
            },
          ),
        ],
      },
    ])

    expect(stories).toHaveLength(1)
    expect(stories[0].newsroomCount).toBe(2)
    expect(stories[0].coverage.map(c => c.publisher.id)).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('keeps unrelated stories apart', () => {
    const stories = clusterArticles([
      {
        publisher: publisher('alpha'),
        articles: [article('Rhine freight rates hit a four-year high')],
      },
      {
        publisher: publisher('beta'),
        articles: [article('Data broker sold location pings from a kids app')],
      },
    ])

    expect(stories).toHaveLength(2)
    expect(stories.every(story => story.newsroomCount === 1)).toBe(true)
  })

  it('never folds one outlet twice into a story', () => {
    const alpha = publisher('alpha')
    const stories = clusterArticles([
      {
        publisher: alpha,
        articles: [
          article('Ministers agree emergency gas storage targets', {
            link: 'https://alpha.example/one',
          }),
          article('Ministers agree emergency gas storage targets, analysis', {
            link: 'https://alpha.example/two',
          }),
        ],
      },
    ])

    expect(stories).toHaveLength(2)
  })

  it('ranks the most widely covered story first', () => {
    const shared = 'Ministers agree emergency gas storage targets'
    const stories = clusterArticles([
      {
        publisher: publisher('alpha'),
        articles: [
          article('Rhine freight rates hit a four-year high', {
            link: 'https://alpha.example/rhine',
            publishedAt: '2026-09-07T12:00:00.000Z',
          }),
        ],
      },
      {
        publisher: publisher('beta'),
        articles: [article(shared, {link: 'https://beta.example/gas'})],
      },
      {
        publisher: publisher('gamma'),
        articles: [
          article(`${shared} after standoff`, {
            link: 'https://gamma.example/gas',
          }),
        ],
      },
    ])

    expect(stories[0].newsroomCount).toBe(2)
  })

  it('files a story under the section its coverage agrees on', () => {
    const stories = clusterArticles([
      {
        publisher: publisher('alpha'),
        articles: [
          article('Ministers agree emergency gas storage targets', {
            link: 'https://alpha.example/one',
            categories: ['Markets'],
          }),
        ],
      },
      {
        publisher: publisher('beta'),
        articles: [
          article('Ministers agree emergency storage targets for gas', {
            link: 'https://beta.example/two',
            categories: ['Climate'],
          }),
        ],
      },
      {
        publisher: publisher('gamma'),
        articles: [
          article('Ministers agree emergency gas targets after storage row', {
            link: 'https://gamma.example/three',
            categories: ['Environment'],
          }),
        ],
      },
    ])

    expect(stories[0].section.id).toBe('climate')
  })
})

describe('groupStoriesBySection', () => {
  it('drops sections with no stories and keeps the given order', () => {
    const stories = clusterArticles([
      {
        publisher: publisher('alpha'),
        articles: [
          article('A new telescope resolves a decades-old dispute', {
            categories: ['Science'],
          }),
        ],
      },
      {
        publisher: publisher('beta'),
        articles: [
          article('Parliament passes the digital identity bill', {
            categories: ['Politics'],
          }),
        ],
      },
    ])

    const groups = groupStoriesBySection(stories, EXPLORE_SECTIONS)

    expect(groups.map(group => group.section.id)).toEqual([
      'politics',
      'science',
    ])
  })
})
