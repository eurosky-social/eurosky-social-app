import {describe, expect, it, jest} from '@jest/globals'

import {frontpageFromProfile, isAccountAddress} from './frontpages'

/* The hooks are not under test; their modules pull in native-only state. */
jest.mock('#/state/queries/profile', () => ({}))
jest.mock('#/state/session', () => ({}))
jest.mock('#/state/session/resolve-pds', () => ({}))
jest.mock('#/features/news/dutch/queries', () => ({}))

describe('isAccountAddress', () => {
  it('treats DIDs and handles as account addresses', () => {
    expect(isAccountAddress('did:plc:5u54z2qgkq43dh2nzwzdbbhb')).toBe(true)
    expect(isAccountAddress('ft.com')).toBe(true)
    expect(isAccountAddress('nos.bsky.social')).toBe(true)
  })

  it('treats aggregator slugs as slugs', () => {
    expect(isAccountAddress('nos')).toBe(false)
    expect(isAccountAddress('rtl-nieuws')).toBe(false)
  })
})

describe('frontpageFromProfile', () => {
  it('addresses the page by what opened it and keeps brand extras', () => {
    const frontpage = frontpageFromProfile(
      {
        did: 'did:plc:5u54z2qgkq43dh2nzwzdbbhb',
        handle: 'ft.com',
        displayName: 'Financial Times',
      },
      'ft.com',
    )
    expect(frontpage.slug).toBe('ft.com')
    expect(frontpage.name).toBe('Financial Times')
    expect(frontpage.accent).toBe('#990F3D')
    expect(frontpage.reporterDids.length).toBeGreaterThan(0)
    expect(frontpage.reporterDids).not.toContain(frontpage.did)
  })

  it('falls back to the handle for a name', () => {
    const frontpage = frontpageFromProfile(
      {did: 'did:plc:abc', handle: 'someone.example'},
      'did:plc:abc',
    )
    expect(frontpage.name).toBe('someone.example')
    expect(frontpage.reporterDids).toEqual([])
  })
})
