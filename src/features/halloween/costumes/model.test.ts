import {
  costumeSchema,
  createCostume,
  EMPTY_PIXELS,
  floodFill,
  GRID_SIZE,
  isEmpty,
  paintLine,
  parseCostumes,
  pixelPaths,
  pointOnGrid,
  sameCostume,
  TRANSPARENT,
  withColor,
} from './model'

it('creates bounded 64x64 art with independent arrays and palettes', () => {
  const first = createCostume()
  const second = createCostume()
  expect(costumeSchema.parse(first)).toEqual(first)
  expect(first.version).toBe(2)
  expect(first.pixels).toHaveLength(4096)
  first.palette[0] = '#123456'
  first.pixels[0] = 1
  expect(second.palette[0]).not.toBe('#123456')
  expect(second.pixels[0]).toBe(TRANSPARENT)
  expect(isEmpty(second)).toBe(true)
  expect(JSON.parse(JSON.stringify(second))).toEqual(second)
})

it('upgrades v1 art using exact nearest-neighbor pixels without losing colors', () => {
  const legacy = {
    version: 1,
    gridSize: 32,
    palette: ['#123456', '#ABCDEF'],
    pixels: `01${'.'.repeat(1022)}`,
    updatedAt: '2026-10-28T12:00:00.000Z',
  }
  const upgraded = costumeSchema.parse(legacy)
  expect(upgraded.version).toBe(2)
  expect(upgraded.palette).toEqual(legacy.palette)
  expect(upgraded.updatedAt).toBe(legacy.updatedAt)
  expect(upgraded.pixels.slice(0, 5)).toEqual([0, 0, 1, 1, -1])
  expect(upgraded.pixels.slice(64, 69)).toEqual([0, 0, 1, 1, -1])
  expect(upgraded.pixels[128]).toBe(TRANSPARENT)
})

it.each([
  {version: 3},
  {gridSize: 128},
  {palette: []},
  {palette: Array(257).fill('#FFFFFF')},
  {palette: ['url(https://example.com)']},
  {pixels: []},
  {pixels: Array(4096).fill(256)},
  {pixels: Array(4096).fill(-2)},
  {pixels: Array(4096).fill(0.5)},
  {pixels: Array(4096).fill(100)},
  {updatedAt: 'yesterday'},
])('rejects invalid or unbounded art: %p', patch => {
  expect(costumeSchema.safeParse({...createCostume(), ...patch}).success).toBe(
    false,
  )
})

it('revalidates local storage before rendering', () => {
  expect(parseCostumes(undefined)).toEqual({})
  expect(parseCostumes({'did:plc:bad': {pixels: 'nope'}})).toEqual({})
  const costume = createCostume()
  expect(parseCostumes({'did:plc:alice': costume})).toEqual({
    'did:plc:alice': costume,
  })
})

it('draws continuous lines in both directions without wrapping rows', () => {
  for (const [from, to] of [
    [
      {x: 0, y: 0},
      {x: 63, y: 0},
    ],
    [
      {x: 0, y: 0},
      {x: 0, y: 63},
    ],
    [
      {x: 63, y: 63},
      {x: 0, y: 0},
    ],
    [
      {x: 0, y: 63},
      {x: 63, y: 0},
    ],
  ]) {
    const result = paintLine(EMPTY_PIXELS, from, to, 2)
    expect(result.filter(pixel => pixel === 2)).toHaveLength(64)
    expect(result[to.y * GRID_SIZE + to.x]).toBe(2)
  }
  const edge = paintLine(EMPTY_PIXELS, {x: 63, y: 0}, {x: 63, y: 0}, 2, 8)
  expect(edge[64]).toBe(TRANSPARENT)
  expect(paintLine(EMPTY_PIXELS, {x: -1, y: 0}, {x: 0, y: 0}, 1)).toBe(
    EMPTY_PIXELS,
  )
  expect(paintLine(EMPTY_PIXELS, {x: 0, y: 0}, {x: 64, y: 0}, 1)).toBe(
    EMPTY_PIXELS,
  )
})

it('uses circular variable-size brushes and erases exactly the same footprint', () => {
  const point = {x: 32, y: 32}
  const single = paintLine(EMPTY_PIXELS, point, point, 1)
  const broad = paintLine(EMPTY_PIXELS, point, point, 1, 8)
  expect(single.filter(pixel => pixel === 1)).toHaveLength(1)
  expect(broad.filter(pixel => pixel === 1).length).toBeGreaterThan(40)
  expect(broad.filter(pixel => pixel === 1).length).toBeLessThan(64)
  expect(paintLine(broad, point, point, TRANSPARENT, 8)).toEqual(EMPTY_PIXELS)
})

it('fills enclosed drawing regions, not diagonals or the underlying photo', () => {
  let pixels = paintLine(EMPTY_PIXELS, {x: 10, y: 10}, {x: 20, y: 10}, 0)
  pixels = paintLine(pixels, {x: 20, y: 10}, {x: 20, y: 20}, 0)
  pixels = paintLine(pixels, {x: 20, y: 20}, {x: 10, y: 20}, 0)
  pixels = paintLine(pixels, {x: 10, y: 20}, {x: 10, y: 10}, 0)
  const filled = floodFill(pixels, {x: 15, y: 15}, 1)
  expect(filled.filter(pixel => pixel === 1)).toHaveLength(81)
  expect(filled[0]).toBe(TRANSPARENT)
  expect(filled[10 * GRID_SIZE + 15]).toBe(0)
  expect(floodFill(filled, {x: 15, y: 15}, 1)).toBe(filled)
  const diagonal = Array(4096).fill(0) as number[]
  diagonal[0] = diagonal[65] = TRANSPARENT
  expect(floodFill(diagonal, {x: 0, y: 0}, 2)[65]).toBe(TRANSPARENT)
})

it('adds custom colors without recoloring earlier pixels and caps palette size', () => {
  const original = createCostume()
  original.pixels[0] = 0
  const added = withColor(original, '#123abc')!
  expect(added.costume.palette[added.ink]).toBe('#123ABC')
  expect(added.costume.palette[0]).toBe(original.palette[0])
  expect(added.costume.pixels).toBe(original.pixels)
  expect(withColor(added.costume, '#123AbC')!.ink).toBe(added.ink)
  const full = {
    ...original,
    palette: Array.from(
      {length: 256},
      (_, i) => `#${i.toString(16).padStart(6, '0')}`,
    ),
  }
  const recycled = withColor(full, '#ABCDEF')!
  expect(recycled.ink).not.toBe(0)
  expect(recycled.costume.palette).toHaveLength(256)
  full.pixels = Array.from({length: 4096}, (_, i) => i % 256)
  expect(withColor(full, '#ABCDEF')).toBeNull()
})

it('maps resized rectangular controls and breaks strokes outside the surface', () => {
  expect(pointOnGrid(128, 64, 256)).toEqual({x: 32, y: 16})
  expect(pointOnGrid(100, 10, 200, 360, 20)).toEqual({x: 180, y: 180})
  for (const [x, y, size] of [
    [-1, 0, 256],
    [0, 256, 256],
    [256, 0, 256],
    [NaN, 0, 256],
    [0, 0, 0],
  ])
    expect(pointOnGrid(x, y, size)).toBeNull()
})

it('batches horizontal runs without merging across row boundaries', () => {
  const pixels = [...EMPTY_PIXELS]
  pixels[0] = pixels[1] = pixels[63] = pixels[64] = 0
  expect(pixelPaths(pixels, ['#000000'])).toEqual([
    'M0 0h2v1h-2zM63 0h1v1h-1zM0 1h1v1h-1z',
  ])
  expect(pixelPaths(EMPTY_PIXELS, ['#000000'])).toEqual([''])
  expect(sameCostume(createCostume(), createCostume())).toBe(true)
})
