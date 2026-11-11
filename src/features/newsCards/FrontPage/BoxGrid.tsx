import {View} from 'react-native'

import {useTheme} from '#/alf'
import {
  type Columns,
  type PlannedCell,
  type PlannedRow,
  type Span,
} from '../slotting'

/** Inner padding of every cell; lines sit on the cell edges, never inside. */
export const CELL_PADDING = 20

function displaySpan(span: Span, columns: Columns) {
  return columns === 1 ? 1 : Math.min(span, columns)
}

/**
 * A fully boxed grid of 1px hairlines with one owner per line: the frame draws
 * its top and left edges, and every cell its right and bottom edges, so
 * neighbours share a single line and the frame always closes. Cells stretch
 * to the row's height, so vertical lines run from one horizontal line to the
 * next. The last card of a short row fills the row instead of leaving a gap.
 */
export function BoxGrid({
  rows,
  columns,
  renderCell,
  testID,
}: {
  rows: readonly Extract<PlannedRow, {type: 'cards'}>[]
  columns: Columns
  renderCell: (cell: PlannedCell) => React.ReactNode
  testID?: string
}) {
  const t = useTheme()
  if (!rows.length) return null
  return (
    <View
      testID={testID}
      style={[
        {borderTopWidth: 1, borderLeftWidth: 1},
        t.atoms.border_contrast_low,
      ]}>
      {rows.map(row => {
        const spans = row.cells.map(cell => displaySpan(cell.span, columns))
        const used = spans.reduce((sum, span) => sum + span, 0)
        return (
          <View
            key={row.cells[0].index}
            testID={`frontPageRow-${spans.join('-')}`}
            style={{flexDirection: 'row', alignItems: 'stretch'}}>
            {row.cells.map((cell, position) => {
              const fills = used < columns && position === row.cells.length - 1
              return (
                <View
                  key={cell.index}
                  testID={`boxCell-${cell.index}`}
                  style={[
                    fills
                      ? {flex: 1}
                      : {width: `${(spans[position] / columns) * 100}%`},
                    {
                      minWidth: 0,
                      padding: CELL_PADDING,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                    },
                    t.atoms.border_contrast_low,
                  ]}>
                  {renderCell(cell)}
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}
