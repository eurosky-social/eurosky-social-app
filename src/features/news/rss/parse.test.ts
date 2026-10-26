import {describe, expect, it} from '@jest/globals'

import {extractSiteIcon} from './parse'

describe('extractSiteIcon', () => {
  it('prefers the apple-touch-icon over a larger plain icon', () => {
    const html = `<head>
      <link rel="icon" type="image/png" href="https://cdn.example/icon-192.png" sizes="192x192">
      <link rel="apple-touch-icon" href="https://cdn.example/apple-touch-icon.png">
    </head>`
    expect(extractSiteIcon(html, 'https://example.nl/')).toBe(
      'https://cdn.example/apple-touch-icon.png',
    )
  })

  it('takes the largest icon when there is no touch icon', () => {
    const html = `
      <link rel="icon" sizes="16x16" href="/favicon-16x16.png">
      <link rel="icon" sizes="32x32" href="/favicon-32x32.png">`
    expect(extractSiteIcon(html, 'https://example.nl/')).toBe(
      'https://example.nl/favicon-32x32.png',
    )
  })

  it('reads the misspelt `size` attribute some sites ship', () => {
    const html = `
      <link rel="icon" type="image/x-icon" href="/favicon.ico">
      <link rel="icon" type="image/png" href="/android-192.png" size="192x192">`
    expect(extractSiteIcon(html, 'https://example.nl/')).toBe(
      'https://example.nl/android-192.png',
    )
  })

  it('resolves relative hrefs and decodes entities', () => {
    const html = `<link href="/assets/icon.png?v=1&amp;b=2" rel="shortcut icon">`
    expect(extractSiteIcon(html, 'https://example.nl/news/')).toBe(
      'https://example.nl/assets/icon.png?v=1&b=2',
    )
  })

  it('skips mask icons and other links', () => {
    const html = `
      <link rel="mask-icon" href="/safari-pinned-tab.svg">
      <link rel="stylesheet" href="/site.css">`
    expect(extractSiteIcon(html, 'https://example.nl/')).toBeUndefined()
  })
})
