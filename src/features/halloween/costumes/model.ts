import {z} from 'zod'

export const GRID_SIZE = 64
export const TRANSPARENT = -1
export const EMPTY_PIXELS = Array<number>(GRID_SIZE * GRID_SIZE).fill(
  TRANSPARENT,
)
export const DEFAULT_PALETTE = [
  '#17121F',
  '#FFFFFF',
  '#FF8A24',
  '#FFD449',
  '#ED445E',
  '#FF9ACB',
  '#8E59FF',
  '#47318C',
  '#66C95A',
  '#249A82',
  '#55BFFF',
  '#8D593E',
]
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

const currentSchema = z
  .object({
    version: z.literal(2),
    gridSize: z.literal(GRID_SIZE),
    palette: z.array(colorSchema).min(1).max(256),
    /** Row-major palette indices; -1 is transparent. */
    pixels: z
      .array(z.number().int().min(TRANSPARENT).max(255))
      .length(GRID_SIZE * GRID_SIZE),
    updatedAt: z.string().datetime(),
  })
  .refine(value => value.pixels.every(pixel => pixel < value.palette.length))

const legacySchema = z
  .object({
    version: z.literal(1),
    gridSize: z.literal(32),
    palette: z.array(colorSchema).min(1).max(16),
    pixels: z
      .string()
      .length(1024)
      .regex(/^[.0-9a-f]+$/),
    updatedAt: z.string().datetime(),
  })
  .refine(value =>
    [...value.pixels].every(
      pixel => pixel === '.' || parseInt(pixel, 16) < value.palette.length,
    ),
  )

export type Costume = z.infer<typeof currentSchema>
export type Point = {x: number; y: number}

/** Accept v1 art without destructive resampling; new saves always use v2. */
export const costumeSchema = z
  .union([currentSchema, legacySchema])
  .transform((value): Costume => {
    if (value.version === 2) return value
    return {
      ...value,
      version: 2,
      gridSize: GRID_SIZE,
      pixels: Array.from({length: GRID_SIZE * GRID_SIZE}, (_, index) => {
        const x = Math.floor((index % GRID_SIZE) / 2)
        const y = Math.floor(Math.floor(index / GRID_SIZE) / 2)
        const pixel = value.pixels[y * 32 + x]
        return pixel === '.' ? TRANSPARENT : parseInt(pixel, 16)
      }),
    }
  })

/** Revalidate at the adapter boundary: persisted.tryParse returns raw data. */
export function parseCostumes(value: unknown): Record<string, Costume> {
  const result = z.record(costumeSchema).safeParse(value)
  return result.success ? result.data : {}
}

export function createCostume(): Costume {
  return {
    version: 2,
    gridSize: GRID_SIZE,
    palette: [...DEFAULT_PALETTE],
    pixels: [...EMPTY_PIXELS],
    updatedAt: new Date().toISOString(),
  }
}

export function isEmpty(costume: Costume) {
  return costume.pixels.every(pixel => pixel === TRANSPARENT)
}

export function sameCostume(a: Costume, b: Costume) {
  return (
    a.palette.length === b.palette.length &&
    a.palette.every((color, i) => color === b.palette[i]) &&
    a.pixels.every((pixel, i) => pixel === b.pixels[i])
  )
}

export function validPoint(point: Point) {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < GRID_SIZE &&
    point.y < GRID_SIZE
  )
}

/** Interpolated circular stamps leave no gaps, even during fast pointer moves. */
export function paintLine(
  pixels: number[],
  from: Point,
  to: Point,
  ink: number,
  brushSize = 1,
): number[] {
  if (
    !validPoint(from) ||
    !validPoint(to) ||
    !Number.isInteger(ink) ||
    ink < TRANSPARENT ||
    ink > 255 ||
    !Number.isInteger(brushSize) ||
    brushSize < 1 ||
    brushSize > 16
  )
    return pixels
  const next = [...pixels]
  const low = -Math.floor(brushSize / 2)
  const center = low + (brushSize - 1) / 2
  const stamp = (x: number, y: number) => {
    for (let dy = low; dy < low + brushSize; dy++) {
      for (let dx = low; dx < low + brushSize; dx++) {
        if ((dx - center) ** 2 + (dy - center) ** 2 > (brushSize / 2) ** 2)
          continue
        if (
          x + dx >= 0 &&
          x + dx < GRID_SIZE &&
          y + dy >= 0 &&
          y + dy < GRID_SIZE
        )
          next[(y + dy) * GRID_SIZE + x + dx] = ink
      }
    }
  }
  let {x, y} = from
  const dx = Math.abs(to.x - x)
  const dy = -Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1
  const sy = y < to.y ? 1 : -1
  let error = dx + dy
  while (true) {
    stamp(x, y)
    if (x === to.x && y === to.y) break
    const twiceError = 2 * error
    if (twiceError >= dy) {
      error += dy
      x += sx
    }
    if (twiceError <= dx) {
      error += dx
      y += sy
    }
  }
  return next.every((pixel, index) => pixel === pixels[index]) ? pixels : next
}

/** Iterative, four-connected fill of the drawing layer, never the photograph. */
export function floodFill(
  pixels: number[],
  point: Point,
  ink: number,
): number[] {
  if (
    !validPoint(point) ||
    !Number.isInteger(ink) ||
    ink < TRANSPARENT ||
    ink > 255
  )
    return pixels
  const start = point.y * GRID_SIZE + point.x
  const target = pixels[start]
  if (target === ink) return pixels
  const next = [...pixels]
  const queue = [start]
  next[start] = ink
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]
    const x = index % GRID_SIZE
    const visit = (neighbor: number) => {
      if (next[neighbor] === target) {
        next[neighbor] = ink
        queue.push(neighbor)
      }
    }
    if (x > 0) visit(index - 1)
    if (x < GRID_SIZE - 1) visit(index + 1)
    if (index >= GRID_SIZE) visit(index - GRID_SIZE)
    if (index < next.length - GRID_SIZE) visit(index + GRID_SIZE)
  }
  return next
}

/** Append a color, or recycle an unused slot without recoloring existing art. */
export function withColor(
  costume: Costume,
  color: string,
): {costume: Costume; ink: number} | null {
  if (!colorSchema.safeParse(color).success) return null
  const normalized = color.toUpperCase()
  const existing = costume.palette.findIndex(
    item => item.toUpperCase() === normalized,
  )
  if (existing >= 0) return {costume, ink: existing}
  const used = new Set(costume.pixels)
  const free = costume.palette.findIndex((_, index) => !used.has(index))
  const ink = costume.palette.length < 256 ? costume.palette.length : free
  if (ink < 0) return null
  const palette = [...costume.palette]
  palette[ink] = normalized
  return {costume: {...costume, palette}, ink}
}

export function pointOnGrid(
  x: number,
  y: number,
  size: number,
  gridSize = GRID_SIZE,
  height = size,
): Point | null {
  if (
    ![x, y, size, height].every(Number.isFinite) ||
    size <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0 ||
    x >= size ||
    y >= height
  )
    return null
  return {
    x: Math.floor((x / size) * gridSize),
    y: Math.floor((y / height) * gridSize),
  }
}

/** One path per used color, rather than one native view per pixel. */
export function pixelPaths(pixels: number[], palette: string[]) {
  const paths = palette.map(() => '')
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE;) {
      const pixel = pixels[y * GRID_SIZE + x]
      const start = x++
      while (x < GRID_SIZE && pixels[y * GRID_SIZE + x] === pixel) x++
      if (pixel >= 0 && pixel < paths.length)
        paths[pixel] += `M${start} ${y}h${x - start}v1h-${x - start}z`
    }
  }
  return paths
}
