import {router} from '#/routes'
import {makeTileAppLink, tileUriFromAppRoute} from './links'

describe('makeTileAppLink', () => {
  it('names the author by handle when there is a good one', () => {
    expect(
      makeTileAppLink({did: 'did:plc:a', handle: 'robin.berjon.com'}, 'bad'),
    ).toBe('/robin.berjon.com/app/bad')
  })

  it('falls back to the DID, colons and all', () => {
    expect(makeTileAppLink({did: 'did:plc:a'}, 'bad')).toBe(
      '/did:plc:a/app/bad',
    )
    expect(
      makeTileAppLink({did: 'did:plc:a', handle: 'handle.invalid'}, 'bad'),
    ).toBe('/did:plc:a/app/bad')
  })
})

describe('the TileApp route', () => {
  it('matches the links made for it, and gives the tile back', () => {
    for (const author of ['robin.berjon.com', 'did:plc:a']) {
      const [name, params] = router.matchPath(`/${author}/app/bad`)
      expect(name).toBe('TileApp')
      expect(params).toEqual({name: author, rkey: 'bad'})
      expect(tileUriFromAppRoute(params.name, params.rkey)).toBe(
        `at://${author}/ing.dasl.masl/bad`,
      )
    }
  })

  it('leaves the routes that start with a word of their own alone', () => {
    expect(router.matchPath('/apps')[0]).toBe('Apps')
    expect(router.matchPath('/profile/robin.berjon.com/post/abc')[0]).toBe(
      'PostThread',
    )
    expect(router.matchPath('/settings/app-passwords')[0]).toBe('AppPasswords')
    expect(router.matchPath('/starter-pack/app/abc')[0]).toBe('StarterPack')
  })
})
