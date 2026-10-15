import {MAX_TILE_HEIGHT, MIN_TILE_HEIGHT} from './constants'
import {tileHeight} from './sizing'

describe('tileHeight', () => {
  it('scales a requested size to the card width', () => {
    expect(tileHeight({width: 800, height: 600}, 400)).toBe(300)
    expect(tileHeight({width: 720, height: 520}, 360)).toBe(260)
  })

  it('uses a bare height as is, and the default ratio without sizing', () => {
    expect(tileHeight({height: 420}, 400)).toBe(420)
    expect(tileHeight(undefined, 640)).toBe(360)
    expect(tileHeight(undefined, 0)).toBe(315)
  })

  it('stays within bounds', () => {
    expect(tileHeight({height: 10}, 400)).toBe(MIN_TILE_HEIGHT)
    expect(tileHeight({height: 5000}, 400)).toBe(MAX_TILE_HEIGHT)
    expect(tileHeight({width: 100, height: 1000}, 400)).toBe(MAX_TILE_HEIGHT)
  })
})
