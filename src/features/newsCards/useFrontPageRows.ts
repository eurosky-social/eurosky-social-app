import {useState} from 'react'

import {
  type Columns,
  continueRows,
  type PlannedRow,
  reflowRows,
} from './slotting'

type Layout = {
  keys: readonly string[]
  hasMedia: readonly boolean[]
  shorts: boolean
  rows: PlannedRow[]
}

/**
 * Plan rows once on three columns and reflow for the current width. When
 * stories are only appended, complete rows stay as they were, so loading more
 * never reshuffles what the reader has already seen.
 */
export function useFrontPageRows(
  keys: readonly string[],
  hasMedia: readonly boolean[],
  columns: Columns,
  {shorts = false}: {shorts?: boolean} = {},
): PlannedRow[] {
  const [layout, setLayout] = useState<Layout>(() => ({
    keys,
    hasMedia,
    shorts,
    rows: continueRows([], hasMedia, {shorts}),
  }))
  const appendOnly =
    layout.shorts === shorts &&
    layout.keys.length <= keys.length &&
    layout.keys.every(
      (key, index) =>
        key === keys[index] && layout.hasMedia[index] === hasMedia[index],
    )

  if (appendOnly && layout.keys.length === keys.length)
    return reflowRows(layout.rows, columns)

  /*
   * Keep every complete row. Only a trailing row that was cut short because
   * the stories ran out is planned again, together with anything after it.
   */
  let frozen: PlannedRow[] = []
  if (appendOnly) {
    let lastCards = -1
    layout.rows.forEach((row, index) => {
      if (row.type === 'cards') lastCards = index
    })
    const last = layout.rows[lastCards]
    frozen =
      last?.type === 'cards' && last.partial
        ? layout.rows.slice(0, lastCards)
        : layout.rows
  }
  const next = {
    keys,
    hasMedia,
    shorts,
    rows: continueRows(frozen, hasMedia, {shorts}),
  }
  setLayout(next)
  return reflowRows(next.rows, columns)
}
