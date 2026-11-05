import {
  groupByService,
  humanizeRecordName,
  serviceForCollection,
} from './services'

describe('serviceForCollection', () => {
  it('maps known namespaces to their service', () => {
    expect(serviceForCollection('app.bsky.feed.post').name).toBe('Bluesky')
    expect(serviceForCollection('social.mu.newsFeedPrefs').name).toBe('Mu')
    expect(serviceForCollection('sh.tangled.repo').name).toBe('Tangled')
    expect(serviceForCollection('social.grain.actor.profile').name).toBe(
      'Grain',
    )
    expect(serviceForCollection('net.anisota.beta.game.log').name).toBe(
      'Anisota',
    )
    expect(serviceForCollection('blog.pckt.mini.post').name).toBe('pckt')
    expect(serviceForCollection('fm.plyr.track').name).toBe('plyr.fm')
    expect(serviceForCollection('app.offprint.document.article').name).toBe(
      'Offprint',
    )
  })

  it('does not match a prefix that only shares leading characters', () => {
    expect(serviceForCollection('app.bskyfake.thing').name).toBe('bskyfake.app')
  })

  it('falls back to the domain for unknown namespaces', () => {
    expect(serviceForCollection('com.example.thing').name).toBe('example.com')
  })
})

describe('groupByService', () => {
  it('groups, totals and sorts by size', () => {
    const result = groupByService([
      {nsid: 'social.mu.newsFeedPrefs', count: 1},
      {nsid: 'app.bsky.feed.like', count: 1000},
      {nsid: 'app.bsky.feed.post', count: 20},
    ])

    expect(result.map(s => s.name)).toEqual(['Bluesky', 'Mu'])
    expect(result[0].total).toBe(1020)
    expect(result[0].collections.map(c => c.nsid)).toEqual([
      'app.bsky.feed.like',
      'app.bsky.feed.post',
    ])
  })
})

describe('groupByService without counts', () => {
  it('puts services with more record types first', () => {
    const result = groupByService(
      [
        'xyz.statusphere.status',
        'app.bsky.feed.like',
        'app.bsky.feed.post',
        'pub.leaflet.document',
        'pub.leaflet.publication',
        'app.bsky.actor.profile',
      ].map(nsid => ({nsid, count: 0})),
    )

    expect(result.map(s => s.name)).toEqual([
      'Bluesky',
      'Leaflet',
      'Statusphere',
    ])
  })
})

describe('humanizeRecordName', () => {
  it('splits camelCase record names into a sentence-case label', () => {
    expect(humanizeRecordName('app.example.newsFeedPrefs')).toBe(
      'News feed prefs',
    )
    expect(humanizeRecordName('sh.tangled.repo')).toBe('Repo')
  })
})
