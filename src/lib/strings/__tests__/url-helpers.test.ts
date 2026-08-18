import {createProxiedUrl} from '../url-helpers'

describe('createProxiedUrl', () => {
  it('opens external links directly', () => {
    const url = 'https://example.com/article?from=mu#section'

    expect(createProxiedUrl(url)).toBe(url)
  })
})
