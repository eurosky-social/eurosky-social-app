import {MAX_TILE_HEIGHT, MIN_TILE_HEIGHT} from './constants'
import {tileHeight} from './sizing'

describe('tileHeight', () => {
  it('grows a requested size with a wider card', () => {
    expect(tileHeight({width: 400, height: 300}, 800)).toBe(600)
    expect(tileHeight({width: 300, height: 400}, 600)).toBe(800)
  })

  it('never goes below the height a tile asked for', () => {
    expect(tileHeight({width: 800, height: 600}, 400)).toBe(600)
    expect(tileHeight({width: 720, height: 520}, 360)).toBe(520)
    expect(tileHeight({width: 720, height: 520}, 720)).toBe(520)
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
