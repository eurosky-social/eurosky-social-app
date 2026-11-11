import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {type PostArticle} from '#/features/articles/articles'
import {cardCanFeature} from '../model'
import {NewsCard} from '../NewsCard'
import {cardSizeFor, type PlannedRow, reflowRows, type Span} from '../slotting'
import {useFrontPageRows} from '../useFrontPageRows'
import {BoxGrid} from './BoxGrid'
import {useFrontPageColumns} from './useFrontPageColumns'

/**
 * A newspaper front page: rows of one to three stories in a boxed hairline
 * grid, with an optional Shorts section after the third row.
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
  /* Consecutive card rows share one boxed grid; Shorts sits between boxes. */
  const groups: (PlannedRow[] | 'shorts')[] = []
  for (const row of rows) {
    if (row.type === 'shorts') groups.push('shorts')
    else {
      const last = groups.at(-1)
      if (Array.isArray(last)) last.push(row)
      else groups.push([row])
    }
  }
  return (
    <View testID="frontPage" style={[a.gap_2xl, a.pt_lg]}>
      {groups.map((group, index) =>
        group === 'shorts' ? (
          <View
            key="shorts"
            testID="frontPageShorts"
            style={[{borderWidth: 1}, t.atoms.border_contrast_low]}>
            {shorts}
          </View>
        ) : (
          <BoxGrid
            key={index}
            rows={group.flatMap(row => (row.type === 'cards' ? [row] : []))}
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
      <BoxGrid
        testID="frontPageSkeletonGrid"
        rows={rows.flatMap(row => (row.type === 'cards' ? [row] : []))}
        columns={columns}
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
    </View>
  )
}
