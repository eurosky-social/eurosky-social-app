import {tileHostLimitsMessage, tileHostOrigin, tileHostUrl} from './host'
import {tileLimits} from './sizing'

const TILE = 'at://did:plc:izttpdp3l6vss5crelt5kcux/ing.dasl.masl/3mcjwwoqjqs2v'

describe('tileHostUrl', () => {
  it('points the host page at the tile, leaving the loading server implicit', () => {
    expect(
      tileHostUrl(TILE, {
        hostUrl: 'https://webtil.es/host/',
        loadDomain: 'load.webtil.es',
      }),
    ).toBe(`https://webtil.es/host/?tile=${encodeURIComponent(TILE)}`)
  })

  it('passes the loading server when it is not the page default', () => {
    expect(
      tileHostUrl(TILE, {
        hostUrl: 'https://tiles.mu.social/host/',
        loadDomain: 'load.webtil.es',
      }),
    ).toBe(
      `https://tiles.mu.social/host/?tile=${encodeURIComponent(TILE)}&load=load.webtil.es`,
    )
  })
})

describe('tileHostLimitsMessage', () => {
  it('is the host page limits command, with mu limits whole', () => {
    expect(JSON.parse(tileHostLimitsMessage(tileLimits(390, 760)))).toEqual({
      tilesHost: 1,
      action: 'limits',
      minWidth: 390,
      maxWidth: 390,
      minHeight: 200,
      maxHeight: 420,
    })
  })

  it('leaves out what is not a limit', () => {
    expect(
      JSON.parse(tileHostLimitsMessage({minHeight: 200, maxHeight: NaN})),
    ).toEqual({tilesHost: 1, action: 'limits', minHeight: 200})
    expect(tileHostLimitsMessage(tileLimits(0, 760))).not.toContain('Width')
  })

  it('is the same string for the same limits', () => {
    expect(tileHostLimitsMessage(tileLimits(390, 760))).toBe(
      tileHostLimitsMessage(tileLimits(390, 760)),
    )
  })
})

describe('tileHostOrigin', () => {
  it('is the page origin', () => {
    expect(tileHostOrigin('https://webtil.es/host/?x=1')).toBe(
      'https://webtil.es',
    )
  })
})
