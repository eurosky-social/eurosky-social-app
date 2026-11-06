import {describe, expect, it} from '@jest/globals'

import {articleLinkKey} from './articleLinks'

describe('article destinations', () => {
  it.each([
    'https://www.wired.com/story/example/',
    'http://wired.com/story/example',
    'https://WIRED.com/story/example#comments',
    'https://wired.com/story/example/?utm_source=bluesky&utm_medium=social&fbclid=abc',
  ])('deduplicates the same article: %s', url => {
    expect(articleLinkKey(url)).toBe(
      articleLinkKey('https://wired.com/story/example'),
    )
  })
  it('sorts query parameters without dropping meaningful article IDs or editions', () => {
    expect(articleLinkKey('https://news.example/read?lang=en&id=12')).toBe(
      articleLinkKey('https://news.example/read?id=12&lang=en'),
    )
    expect(articleLinkKey('https://news.example/read?id=12')).not.toBe(
      articleLinkKey('https://news.example/read?id=13'),
    )
    expect(articleLinkKey('https://news.example/read?lang=en')).not.toBe(
      articleLinkKey('https://news.example/read?lang=de'),
    )
  })
  it('leaves unsupported or malformed destinations unchanged', () => {
    expect(articleLinkKey('not a URL')).toBe('not a URL')
    expect(articleLinkKey('at://did:plc:owner/app.bsky.feed.post/a')).toBe(
      'at://did:plc:owner/app.bsky.feed.post/a',
    )
  })
})
