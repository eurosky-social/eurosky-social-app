import {cookieExpiries} from './scrub'

describe('cookieExpiries', () => {
  it('has nothing to do without cookies', () => {
    expect(cookieExpiries('', 'mu.social', '/')).toEqual([])
  })

  it('expires each name host-only and for the host and its parents', () => {
    const out = cookieExpiries('a=1; b=2', 'staging.mu.social', '/')
    const gone = 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'
    expect(out).toEqual([
      `a=; ${gone}`,
      `a=; ${gone}; Domain=staging.mu.social`,
      `a=; ${gone}; Domain=mu.social`,
      `b=; ${gone}`,
      `b=; ${gone}; Domain=staging.mu.social`,
      `b=; ${gone}; Domain=mu.social`,
    ])
  })

  it('never names a bare top-level domain', () => {
    const out = cookieExpiries('a=1', 'mu.social', '/')
    expect(out.some(c => /Domain=social$/.test(c))).toBe(false)
    expect(out.some(c => /Domain=mu\.social$/.test(c))).toBe(true)
  })

  it('covers every prefix of the current path', () => {
    const out = cookieExpiries('a=1', 'localhost', '/profile/x.test/post/3k')
    expect(out.map(c => c.match(/Path=([^;]*)/)?.[1])).toEqual([
      '/',
      '/profile',
      '/profile/x.test',
      '/profile/x.test/post',
      '/profile/x.test/post/3k',
    ])
    expect(out.some(c => c.includes('Domain='))).toBe(false)
  })

  it('counts a repeated name once and skips an address', () => {
    expect(cookieExpiries('a=1; a=2', '127.0.0.1', '/')).toHaveLength(1)
  })
})
