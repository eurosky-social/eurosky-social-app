export type Columns = 1 | 2 | 3
export type Span = 1 | 2 | 3

export type CardSize =
  | 'lead'
  | 'leadTablet'
  | 'leadPhone'
  | 'feature'
  | 'featurePhone'
  | 'standard'
  | 'compact'

export type PlannedCell = {index: number; span: Span}
export type PlannedRow =
  | {
      type: 'cards'
      cells: PlannedCell[]
      /** Set when the stories ran out before the row's shape was filled. */
      partial?: true
    }
  | {type: 'shorts'}

/** Repeating row shapes; Shorts follows the third cards row, once. */
const SHAPES: readonly (readonly Span[])[] = [[3], [2, 1], [1, 1, 1], [1, 2]]
const SHORTS_AFTER_ROW = 3
/** A media slot may promote a story from at most this many places further on. */
const PROMOTION_WINDOW = 3

/** Columns follow the content width, so a wider page gains columns without retuning. */
export function columnsForWidth(contentWidth: number): Columns {
  return contentWidth >= 960 ? 3 : contentWidth >= 600 ? 2 : 1
}

export function cardSizeFor(span: Span, columns: Columns): CardSize {
  if (columns === 1)
    return span === 3 ? 'leadPhone' : span === 2 ? 'featurePhone' : 'compact'
  if (span === 3) return columns === 2 ? 'leadTablet' : 'lead'
  return span === 2 ? 'feature' : 'standard'
}

/**
 * Continue the three-column plan after `frozen` rows, placing every story not
 * already placed. Only stories with media take spans of 2 or 3.
 */
export function continueRows(
  frozen: readonly PlannedRow[],
  hasMedia: readonly boolean[],
  {shorts = false}: {shorts?: boolean} = {},
): PlannedRow[] {
  const rows = [...frozen]
  const placed = new Set(
    frozen.flatMap(row =>
      row.type === 'cards' ? row.cells.map(cell => cell.index) : [],
    ),
  )
  const queue = hasMedia.map((_, index) => index).filter(i => !placed.has(i))
  let cardRows = frozen.filter(row => row.type === 'cards').length
  let shortsDone = frozen.some(row => row.type === 'shorts')

  while (queue.length) {
    const cells: PlannedCell[] = []
    let fallback = false
    for (const span of SHAPES[cardRows % SHAPES.length]) {
      if (!queue.length) break
      if (span === 1) {
        cells.push({index: queue.shift()!, span})
        continue
      }
      const found = queue
        .slice(0, PROMOTION_WINDOW + 1)
        .findIndex(index => hasMedia[index])
      if (found < 0) {
        fallback = true
        break
      }
      cells.push({index: queue.splice(found, 1)[0], span})
    }
    const shape = SHAPES[cardRows % SHAPES.length]
    if (fallback) {
      for (const cell of cells) cell.span = 1
      while (cells.length < 3 && queue.length)
        cells.push({index: queue.shift()!, span: 1})
    }
    const partial = fallback ? cells.length < 3 : cells.length < shape.length
    rows.push(
      partial ? {type: 'cards', cells, partial} : {type: 'cards', cells},
    )
    cardRows++
    if (shorts && !shortsDone && cardRows === SHORTS_AFTER_ROW) {
      rows.push({type: 'shorts'})
      shortsDone = true
    }
  }
  return rows
}

/**
 * Lay a three-column plan out on fewer columns. On two columns, spans of 2 and
 * 3 take a full row and one-third cards pair up, a lone one waiting for the
 * next. On one column, every card has its own row. Cells keep their
 * three-column span so the card size can still tell a Lead from a Feature.
 */
export function reflowRows(
  rows: readonly PlannedRow[],
  columns: Columns,
): PlannedRow[] {
  if (columns === 3) return [...rows]
  const out: PlannedRow[] = []
  let waiting: PlannedCell | undefined
  const flush = () => {
    if (waiting) out.push({type: 'cards', cells: [waiting]})
    waiting = undefined
  }
  for (const row of rows) {
    if (row.type === 'shorts') {
      flush()
      out.push(row)
      continue
    }
    for (const cell of row.cells) {
      if (columns === 1 || cell.span > 1) {
        out.push({type: 'cards', cells: [cell]})
      } else if (waiting) {
        out.push({type: 'cards', cells: [waiting, cell]})
        waiting = undefined
      } else {
        waiting = cell
      }
    }
  }
  flush()
  return out
}

export function planRows(
  hasMedia: readonly boolean[],
  columns: Columns,
  options?: {shorts?: boolean},
): PlannedRow[] {
  return reflowRows(continueRows([], hasMedia, options), columns)
}
