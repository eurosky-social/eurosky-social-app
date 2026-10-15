import {tileHostOrigin, tileHostUrl} from './host'

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

describe('tileHostOrigin', () => {
  it('is the page origin', () => {
    expect(tileHostOrigin('https://webtil.es/host/?x=1')).toBe(
      'https://webtil.es',
    )
  })
})
