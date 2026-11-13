import {MAX_TILE_HEIGHT, MIN_TILE_HEIGHT, TILE_POST_CHROME} from './constants'
import {tileHeight, tileLimits} from './sizing'

describe('tileLimits', () => {
  it('nails the width to the column', () => {
    const limits = tileLimits(412, 900)
    expect(limits.minWidth).toBe(412)
    expect(limits.maxWidth).toBe(412)
    expect(tileLimits(0, 900).maxWidth).toBeUndefined()
  })

  it('leaves the post chrome on screen', () => {
    expect(tileLimits(400, 900).maxHeight).toBe(900 - TILE_POST_CHROME)
    expect(tileLimits(400, 1440).maxHeight).toBe(1440 - TILE_POST_CHROME)
    expect(tileLimits(400, 667.5).maxHeight).toBe(327)
  })

  it('never leaves a tile less than its minimum, however short the screen', () => {
    expect(tileLimits(400, 420).maxHeight).toBe(MIN_TILE_HEIGHT)
    expect(tileLimits(400, 900).minHeight).toBe(MIN_TILE_HEIGHT)
  })

  it('falls back to a fixed ceiling when the viewport is not known', () => {
    expect(tileLimits(400).maxHeight).toBe(MAX_TILE_HEIGHT)
    expect(tileLimits(400, 0).maxHeight).toBe(MAX_TILE_HEIGHT)
  })
})

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

  it('keeps a tile short enough for its post on the screen it is on', () => {
    const phone = tileLimits(390, 760)
    expect(tileHeight({width: 600, height: 700}, 390, undefined, phone)).toBe(
      420,
    )
    expect(tileHeight({height: 300}, 390, 2000, phone)).toBe(420)
    expect(tileHeight({height: 300}, 390, 360, phone)).toBe(360)
    const desktop = tileLimits(600, 1300)
    expect(tileHeight({height: 300}, 600, 2000, desktop)).toBe(960)
  })

  it('stays within bounds', () => {
    expect(tileHeight({height: 10}, 400)).toBe(MIN_TILE_HEIGHT)
    expect(tileHeight({height: 5000}, 400)).toBe(MAX_TILE_HEIGHT)
    expect(tileHeight({width: 100, height: 1000}, 400)).toBe(MAX_TILE_HEIGHT)
  })
})
