import {isTileActivation, tilePostUrl} from './link'

describe('tilePostUrl', () => {
  it('asks the post to open with the tile loading', () => {
    expect(tilePostUrl('https://mu.social/profile/alice.test/post/3abc')).toBe(
      'https://mu.social/profile/alice.test/post/3abc?tile=activate',
    )
  })

  it('keeps whatever query the URL already has', () => {
    expect(
      tilePostUrl('https://mu.social/profile/alice.test/post/3abc?view=reader'),
    ).toBe(
      'https://mu.social/profile/alice.test/post/3abc?view=reader&tile=activate',
    )
  })
})

describe('isTileActivation', () => {
  it('only accepts the exact value', () => {
    expect(isTileActivation('activate')).toBe(true)
    expect(isTileActivation('Activate')).toBe(false)
    expect(isTileActivation(undefined)).toBe(false)
    expect(isTileActivation(['activate'])).toBe(false)
  })
})
