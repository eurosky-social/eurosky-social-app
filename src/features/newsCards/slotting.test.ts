import {
  cardSizeFor,
  columnsForWidth,
  continueRows,
  type PlannedRow,
  planRows,
  planShapes,
  reflowRows,
  type Span,
} from './slotting'

/** Row spans, with 'shorts' for the Shorts row. */
function shape(rows: PlannedRow[]) {
  return rows.map(row =>
    row.type === 'shorts' ? 'shorts' : row.cells.map(cell => cell.span),
  )
}
function order(rows: PlannedRow[]) {
  return rows.flatMap(row =>
    row.type === 'shorts' ? [] : row.cells.map(cell => cell.index),
  )
}
function cards(...rows: Span[][]): PlannedRow[] {
  let index = 0
  return rows.map(spans => ({
    type: 'cards',
    cells: spans.map(span => ({index: index++, span})),
  }))
}

it('chooses columns from the content width', () => {
  expect(columnsForWidth(599)).toBe(1)
  expect(columnsForWidth(600)).toBe(2)
  expect(columnsForWidth(959)).toBe(2)
  expect(columnsForWidth(960)).toBe(3)
  expect(columnsForWidth(1439)).toBe(3)
  expect(columnsForWidth(1440)).toBe(4)
})

it('maps spans to card sizes for each column count', () => {
  expect(cardSizeFor(3, 3)).toBe('lead')
  expect(cardSizeFor(2, 3)).toBe('feature')
  expect(cardSizeFor(1, 3)).toBe('standard')
  expect(cardSizeFor(3, 2)).toBe('leadTablet')
  expect(cardSizeFor(2, 2)).toBe('feature')
  expect(cardSizeFor(1, 2)).toBe('standard')
  expect(cardSizeFor(3, 1)).toBe('leadPhone')
  expect(cardSizeFor(2, 1)).toBe('featurePhone')
  expect(cardSizeFor(1, 1)).toBe('compact')
  expect(cardSizeFor(3, 4)).toBe('lead')
  expect(cardSizeFor(2, 4)).toBe('feature')
  expect(cardSizeFor(1, 4)).toBe('standard')
})

describe('planRows on four columns', () => {
  it('follows 3+1, 2+1+1, 1+1+1+1, Shorts, 1+1+2, then repeats', () => {
    const rows = planRows(Array(17).fill(true), 4, {shorts: true})
    expect(shape(rows)).toEqual([
      [3, 1],
      [2, 1, 1],
      [1, 1, 1, 1],
      'shorts',
      [1, 1, 2],
      [3, 1],
      [2, 1, 1],
    ])
    expect(order(rows)).toHaveLength(17)
  })

  it('falls back to 1+1+1+1 when the next four stories have no media', () => {
    expect(shape(planRows(Array(8).fill(false), 4))).toEqual([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ])
  })

  it('shows a four-column plan as it is', () => {
    const rows = planRows(Array(9).fill(true), 4)
    expect(reflowRows(rows, 4)).toEqual(rows)
  })
})

describe('planRows on three columns', () => {
  it('follows full, 2+1, 1+1+1, Shorts, 1+2, then repeats', () => {
    const rows = planRows(Array(11).fill(true), 3, {shorts: true})
    expect(shape(rows)).toEqual([
      [3],
      [2, 1],
      [1, 1, 1],
      'shorts',
      [1, 2],
      [3],
      [2, 1],
    ])
    expect(order(rows)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('leaves out Shorts unless asked', () => {
    expect(shape(planRows(Array(6).fill(true), 3))).not.toContain('shorts')
  })

  it('promotes the next media story into a media slot', () => {
    const rows = planRows([false, true, false, false, true, true], 3)
    expect(rows[0]).toEqual({type: 'cards', cells: [{index: 1, span: 3}]})
    expect(rows[1].type === 'cards' && rows[1].cells[0].index).toBe(4)
    expect(rows[1].type === 'cards' && rows[1].cells[1].index).toBe(0)
  })

  it('falls back to 1+1+1 when the next four stories have no media', () => {
    const rows = planRows([false, false, false, false, true], 3)
    expect(rows[0]).toEqual({
      type: 'cards',
      cells: [
        {index: 0, span: 1},
        {index: 1, span: 1},
        {index: 2, span: 1},
      ],
    })
  })

  it('places every story once and moves none more than 3 places', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let run = 0; run < 200; run++) {
      const length = 1 + Math.floor(random() * 40)
      const media = Array.from({length}, () => random() < 0.5)
      const placed = order(planRows(media, 3, {shorts: true}))
      expect([...placed].sort((x, y) => x - y)).toEqual(
        Array.from({length}, (_, index) => index),
      )
      placed.forEach((index, position) => {
        expect(Math.abs(index - position)).toBeLessThanOrEqual(3)
      })
    }
  })

  it('never gives a span of 2 or 3 to a story without media', () => {
    const media = [false, true, false, false, false, true, false, true, false]
    for (const row of planRows(media, 3)) {
      if (row.type === 'cards')
        for (const cell of row.cells)
          if (cell.span > 1) expect(media[cell.index]).toBe(true)
    }
  })
})

describe('reflowRows', () => {
  it('gives wide cells their own row and pairs one-third cells on two columns', () => {
    const rows = reflowRows(cards([3], [2, 1], [1, 2], [1, 1, 1]), 2)
    expect(shape(rows)).toEqual([[3], [2], [1, 1], [2], [1, 1], [1]])
    expect(order(rows)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('flushes a waiting one-third card before Shorts', () => {
    const rows = reflowRows(
      [...cards([2, 1]), {type: 'shorts'}, ...cards([1, 1, 1])],
      2,
    )
    expect(shape(rows)).toEqual([[2], [1], 'shorts', [1, 1], [1]])
  })

  it('puts one card per row on one column', () => {
    const rows = reflowRows(cards([3], [2, 1]), 1)
    expect(shape(rows)).toEqual([[3], [2], [1]])
  })
})

describe('continueRows', () => {
  it('keeps frozen rows and continues the rhythm after them', () => {
    const frozen = planRows(Array(3).fill(true), 3)
    const rows = continueRows(frozen, Array(9).fill(true))
    expect(rows.slice(0, frozen.length)).toEqual(frozen)
    expect(shape(rows)).toEqual([[3], [2, 1], [1, 1, 1], [1, 2], [3]])
  })
})

describe('planShapes', () => {
  const TOP: Span[][] = [[3], [2, 1], [1, 1, 1]]
  const placedCount = (rows: PlannedRow[]) => order(rows).length

  it('falls back to 1+1+1 rows when no story has media', () => {
    const rows = planShapes(Array(6).fill(false), TOP)
    expect(shape(rows)).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ])
    expect(placedCount(rows)).toBe(6)
  })

  it('promotes a media story into the Lead', () => {
    const rows = planShapes([false, true, true, false, false, false], TOP)
    expect(rows[0]).toEqual({type: 'cards', cells: [{index: 1, span: 3}]})
  })

  it('fills two rows of 2+1 and 1+1+1 with five stories', () => {
    const rows = planShapes(Array(7).fill(true), [
      [2, 1],
      [1, 1, 1],
    ])
    expect(shape(rows)).toEqual([
      [2, 1],
      [1, 1, 1],
    ])
    expect(placedCount(rows)).toBe(5)
  })

  it('fills the four-column Top stories with nine stories', () => {
    const rows = planShapes(Array(12).fill(true), [
      [3, 1],
      [2, 1, 1],
      [1, 1, 1, 1],
    ])
    expect(shape(rows)).toEqual([
      [3, 1],
      [2, 1, 1],
      [1, 1, 1, 1],
    ])
    expect(placedCount(rows)).toBe(9)
  })

  it('fills a single row of three', () => {
    expect(shape(planShapes(Array(5).fill(true), [[1, 1, 1]]))).toEqual([
      [1, 1, 1],
    ])
  })
})
