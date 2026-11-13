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

  it('gives a tile the height it asks for as it runs', () => {
    expect(tileHeight({width: 400, height: 300}, 800, 450)).toBe(450)
    expect(tileHeight(undefined, 640, 512.4)).toBe(512)
    expect(tileHeight({height: 300}, 400, 0)).toBe(300)
  })

  it('keeps a tile inside the range its manifest declares', () => {
    expect(tileHeight({height: 300, maxHeight: 500}, 400, 700)).toBe(500)
    expect(tileHeight({height: 300, minHeight: 250}, 400, 210)).toBe(250)
    expect(tileHeight({width: 400, height: 300, maxHeight: 400}, 800)).toBe(400)
  })

  it('puts its own limits over the manifest and over requests', () => {
    expect(tileHeight({height: 300}, 400, 1)).toBe(MIN_TILE_HEIGHT)
    expect(tileHeight({height: 300}, 400, 99999)).toBe(MAX_TILE_HEIGHT)
    expect(tileHeight({height: 300, minHeight: 2000}, 400)).toBe(
      MAX_TILE_HEIGHT,
    )
    expect(tileHeight({height: 300, maxHeight: 60}, 400, 60)).toBe(
      MIN_TILE_HEIGHT,
    )
  })

  it('stays within bounds', () => {
    expect(tileHeight({height: 10}, 400)).toBe(MIN_TILE_HEIGHT)
    expect(tileHeight({height: 5000}, 400)).toBe(MAX_TILE_HEIGHT)
    expect(tileHeight({width: 100, height: 1000}, 400)).toBe(MAX_TILE_HEIGHT)
  })
})
