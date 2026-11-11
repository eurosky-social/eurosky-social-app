import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {type PostArticle} from '#/features/articles/articles'
import {cardCanFeature} from '../model'
import {NewsCard} from '../NewsCard'
import {
  cardSizeFor,
  type Columns,
  type PlannedRow,
  reflowRows,
  type Span,
} from '../slotting'
import {useFrontPageRows} from '../useFrontPageRows'
import {useFrontPageColumns} from './useFrontPageColumns'

const COLUMN_GAP = 24

function displaySpan(span: Span, columns: Columns) {
  return columns === 1 ? 1 : Math.min(span, columns)
}

/**
 * A newspaper front page: rows of one to three stories separated by hairline
 * rules, with an optional Shorts section after the third row.
 */
export function FrontPage({
  articles,
  shorts,
}: {
  articles: readonly PostArticle[]
  shorts?: React.ReactNode
}) {
  const t = useTheme()
  const columns = useFrontPageColumns()
  const rows = useFrontPageRows(
    articles.map(article => article.item.uri),
    articles.map(cardCanFeature),
    columns,
    {shorts: !!shorts},
  )
  return (
    <View testID="frontPage">
      {rows.map(row =>
        row.type === 'shorts' ? (
          <View
            key="shorts"
            testID="frontPageShorts"
            style={[{borderTopWidth: 2}, t.atoms.border_contrast_high]}>
            {shorts}
          </View>
        ) : (
          <Row
            key={articles[row.cells[0].index].item.uri}
            row={row}
            columns={columns}
            renderCell={cell => (
              <NewsCard
                article={articles[cell.index]}
                size={cardSizeFor(cell.span, columns)}
              />
            )}
          />
        ),
      )}
    </View>
  )
}

export function Row({
  row,
  columns,
  renderCell,
  testID,
}: {
  row: Extract<PlannedRow, {type: 'cards'}>
  columns: Columns
  renderCell: (cell: {index: number; span: Span}) => React.ReactNode
  testID?: string
}) {
  const t = useTheme()
  const spans = row.cells.map(cell => displaySpan(cell.span, columns))
  return (
    <View
      testID={testID ?? `frontPageRow-${spans.join('-')}`}
      style={[
        a.flex_row,
        a.align_start,
        a.py_xl,
        a.border_b,
        t.atoms.border_contrast_low,
      ]}>
      {row.cells.map((cell, position) => (
        <View
          key={cell.index}
          style={[
            {
              width: `${(spans[position] / columns) * 100}%`,
              minWidth: 0,
              paddingLeft: position > 0 ? COLUMN_GAP : 0,
              paddingRight: position < row.cells.length - 1 ? COLUMN_GAP : 0,
            },
            position > 0 && [a.border_l, t.atoms.border_contrast_low],
          ]}>
          {renderCell(cell)}
        </View>
      ))}
    </View>
  )
}

/** Placeholder cards in the shapes of the first rows, so nothing jumps on load. */
export function FrontPageSkeleton() {
  const t = useTheme()
  const columns = useFrontPageColumns()
  let next = 0
  const rows = reflowRows(
    [[3], [1, 1, 1]].map(spans => ({
      type: 'cards' as const,
      cells: spans.map(span => ({index: next++, span: span as Span})),
    })),
    columns,
  )
  return (
    <View
      testID="frontPageSkeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {rows.map(
        (row, index) =>
          row.type === 'cards' && (
            <Row
              key={index}
              row={row}
              columns={columns}
              testID={`frontPageSkeletonRow-${index}`}
              renderCell={() => (
                <View testID="frontPageSkeletonCard" style={[a.gap_sm]}>
                  <View
                    style={[
                      a.w_full,
                      a.rounded_xs,
                      t.atoms.bg_contrast_50,
                      {aspectRatio: 3 / 2},
                    ]}
                  />
                  <View
                    style={[
                      a.rounded_xs,
                      t.atoms.bg_contrast_50,
                      {height: 12, width: '40%'},
                    ]}
                  />
                  <View
                    style={[
                      a.rounded_xs,
                      t.atoms.bg_contrast_50,
                      {height: 20, width: '90%'},
                    ]}
                  />
                  <View
                    style={[
                      a.rounded_xs,
                      t.atoms.bg_contrast_50,
                      {height: 20, width: '65%'},
                    ]}
                  />
                </View>
              )}
            />
          ),
      )}
    </View>
  )
}
