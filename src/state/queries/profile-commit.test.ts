import {type ImageMeta} from '#/state/gallery'
import {type app} from '#/lexicons'
import {isProfileUpdateCommitted} from './profile-commit'

describe('shared profile commit check', () => {
  it('waits for ordinary fields even when the profile was updated by callback', () => {
    const updates = {
      displayName: 'New name',
      description: 'New bio',
      pronouns: 'they/them',
    }
    expect(
      isProfileUpdateCommitted({
        profile: {},
        updates,
        fresh: {displayName: 'Old name'},
      }),
    ).toBe(false)
    expect(
      isProfileUpdateCommitted({profile: {}, updates, fresh: updates}),
    ).toBe(true)
  })

  it('normalizes empty fields and does not wait for unspecified link fields', () => {
    expect(
      isProfileUpdateCommitted({
        profile: {},
        fresh: {},
        updates: {displayName: '', description: '', pronouns: ''},
      }),
    ).toBe(true)
    expect(
      isProfileUpdateCommitted({
        profile: {},
        fresh: {website: 'https://retained.example/'},
        updates: {displayName: undefined, description: undefined},
      }),
    ).toBe(true)
  })

  it('does not finish until uploaded images are indexed', () => {
    const image = {path: '/new.png'} as ImageMeta
    const profile = {
      avatar: 'https://images.example/old-avatar',
      banner: 'https://images.example/old-banner',
    } as const
    expect(
      isProfileUpdateCommitted({profile, fresh: profile, newUserAvatar: image}),
    ).toBe(false)
    expect(
      isProfileUpdateCommitted({profile, fresh: {}, newUserAvatar: image}),
    ).toBe(false)
    expect(
      isProfileUpdateCommitted({
        profile,
        fresh: {avatar: 'https://images.example/new-avatar'},
        newUserAvatar: image,
      }),
    ).toBe(true)
    expect(
      isProfileUpdateCommitted({profile, fresh: profile, newUserBanner: image}),
    ).toBe(false)
    expect(
      isProfileUpdateCommitted({
        profile,
        fresh: {banner: 'https://images.example/new-banner'},
        newUserBanner: image,
      }),
    ).toBe(true)
  })

  it('handles image removal, including an already absent image', () => {
    expect(
      isProfileUpdateCommitted({
        profile: {avatar: 'https://images.example/old'},
        fresh: {avatar: 'https://images.example/old'},
        newUserAvatar: null,
      }),
    ).toBe(false)
    expect(
      isProfileUpdateCommitted({
        profile: {avatar: 'https://images.example/old'},
        fresh: {},
        newUserAvatar: null,
      }),
    ).toBe(true)
    expect(
      isProfileUpdateCommitted({
        profile: {},
        fresh: {},
        newUserAvatar: null,
        newUserBanner: null,
      }),
    ).toBe(true)
  })

  it('only waits for link refs when explicitly included in expected updates', () => {
    const ref = {
      uri: 'at://did:plc:alice/app.bsky.actor.link/3laaaaaaaaaaa' as const,
      cid: 'new-cid',
    }
    expect(
      isProfileUpdateCommitted({
        profile: {},
        fresh: {},
        updates: {links: [ref]},
      }),
    ).toBe(false)
    const link = {
      ...ref,
      url: 'https://example.com/',
    } as app.bsky.actor.defs.ProfileLinkView
    expect(
      isProfileUpdateCommitted({
        profile: {},
        fresh: {links: [link]},
        updates: {links: [ref]},
      }),
    ).toBe(true)
  })
})
