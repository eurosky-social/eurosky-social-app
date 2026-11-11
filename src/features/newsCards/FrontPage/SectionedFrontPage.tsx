import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type PostArticle} from '#/features/articles/articles'
import {cardCanFeature} from '../model'
import {NewsCard} from '../NewsCard'
import {type FrontSection, latestGroups} from '../sections'
import {
  cardSizeFor,
  type Columns,
  type PlanColumns,
  planColumnsFor,
  planShapes,
  reflowRows,
  type Span,
} from '../slotting'
import {useFrontPageRows} from '../useFrontPageRows'
import {BoxGrid, CELL_PADDING} from './BoxGrid'
import {SectionHeading} from './SectionHeading'
import {useFrontPageColumns} from './useFrontPageColumns'
import {useFrozenSections} from './useFrozenSections'

/** Section shapes for three and four columns; sizes match `sections.ts`. */
const SHAPES: Record<
  PlanColumns,
  Record<'top' | 'twoRows' | 'oneRow', Span[][]>
> = {
  3: {
    top: [[3], [2, 1], [1, 1, 1]],
    twoRows: [
      [2, 1],
      [1, 1, 1],
    ],
    oneRow: [[1, 1, 1]],
  },
  4: {
    top: [
      [3, 1],
      [2, 1, 1],
      [1, 1, 1, 1],
    ],
    twoRows: [
      [2, 1, 1],
      [1, 1, 1, 1],
    ],
    oneRow: [[1, 1, 1, 1]],
  },
}

/**
 * Discover as a newspaper: Top stories, then named sections, then an endless
 * Latest stream with day subheadings. Following shows Top stories and Latest.
 */
export function SectionedFrontPage({
  articles,
  mode,
  shorts,
  complete,
}: {
  articles: readonly PostArticle[]
  mode: 'discover' | 'following' | 'latest'
  shorts?: React.ReactNode
  /** The feed has no more pages; build sections from what there is. */
  complete?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const columns = useFrontPageColumns()
  const sections = useFrozenSections(
    articles,
    mode,
    !!shorts,
    complete,
    columns === 4,
  )
  return (
    <View testID="sectionedFrontPage">
      {sections.map(section =>
        section.kind === 'shorts' ? (
          <View key="shorts" testID="frontPageShorts">
            <SectionHeading
              id="shorts"
              title={l({message: 'Shorts', context: 'section heading'})}
              seeAll={{
                to: {screen: 'Shorts'},
                label: l`See all shorts`,
                text: l`See all →`,
              }}
            />
            <View
              testID="shortsBox"
              style={[
                {
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  padding: CELL_PADDING,
                },
                t.atoms.border_contrast_low,
              ]}>
              {shorts}
            </View>
          </View>
        ) : section.kind === 'latest' ? (
          <Latest
            key="latest"
            articles={section.articles}
            columns={columns}
            heading={mode !== 'latest'}
          />
        ) : (
          <Section key={section.id} section={section} columns={columns} />
        ),
      )}
    </View>
  )
}

function Section({
  section,
  columns,
}: {
  section: FrontSection
  columns: Columns
}) {
  const {t: l} = useLingui()
  const shape = SHAPES[planColumnsFor(columns)]
  const shapes =
    section.kind === 'top'
      ? shape.top
      : section.kind === 'popular' || section.kind === 'video'
        ? shape.twoRows
        : shape.oneRow
  const rows = reflowRows(
    planShapes(section.articles.map(cardCanFeature), shapes),
    columns,
  )
  const name = section.title ?? ''
  const title =
    section.kind === 'top'
      ? l`Top stories`
      : section.kind === 'popular'
        ? l`Popular`
        : section.kind === 'video'
          ? l`Video`
          : section.kind === 'publisher'
            ? l`From ${name}`
            : (section.title ?? '')
  const seeAll =
    section.kind === 'publisher' && section.publisherId
      ? {
          to: {
            screen: 'Publisher' as const,
            params: {publisher: section.publisherId},
          },
          label: l`See all stories from ${name}`,
          text: l`See all →`,
        }
      : section.kind === 'topic' && section.tag
        ? {
            to: {screen: 'Hashtag' as const, params: {tag: section.tag}},
            label: l`See all stories about ${name}`,
            text: l`See all →`,
          }
        : undefined
  return (
    <View testID={`section-${section.id}`}>
      <SectionHeading id={section.id} title={title} seeAll={seeAll} />
      <BoxGrid
        testID={`sectionGrid-${section.id}`}
        rows={rows.flatMap(row => (row.type === 'cards' ? [row] : []))}
        columns={columns}
        renderCell={cell => (
          <NewsCard
            article={section.articles[cell.index]}
            size={cardSizeFor(cell.span, columns)}
          />
        )}
      />
    </View>
  )
}

function Latest({
  articles,
  columns,
  heading,
}: {
  articles: readonly PostArticle[]
  columns: Columns
  /** The News page is all Latest; its page title stands in for the heading. */
  heading: boolean
}) {
  const {t: l} = useLingui()
  if (!articles.length) return null
  return (
    <View testID="section-latest">
      {heading && <SectionHeading id="latest" title={l`Latest`} />}
      {latestGroups(articles, new Date()).map(group => (
        <LatestGroup
          key={group.articles[0].item.uri}
          bucket={group.bucket}
          date={group.date}
          articles={group.articles}
          columns={columns}
        />
      ))}
    </View>
  )
}

function LatestGroup({
  bucket,
  date,
  articles,
  columns,
}: {
  bucket: 'today' | 'yesterday' | 'date'
  date: Date
  articles: readonly PostArticle[]
  columns: Columns
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const rows = useFrontPageRows(
    articles.map(article => article.item.uri),
    articles.map(cardCanFeature),
    columns,
  )
  const label =
    bucket === 'today'
      ? l`Earlier today`
      : bucket === 'yesterday'
        ? l`Yesterday`
        : i18n.date(date, {
            day: 'numeric',
            month: 'long',
            year:
              date.getFullYear() === new Date().getFullYear()
                ? undefined
                : 'numeric',
          })
  return (
    <View>
      <Text
        accessibilityRole="header"
        style={[
          a.pt_lg,
          a.pb_sm,
          {paddingHorizontal: CELL_PADDING},
          a.text_sm,
          a.font_semi_bold,
          t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
      <BoxGrid
        testID={`sectionGrid-latest-${articles[0].item.uri}`}
        rows={rows.flatMap(row => (row.type === 'cards' ? [row] : []))}
        columns={columns}
        renderCell={cell => (
          <NewsCard
            article={articles[cell.index]}
            size={cardSizeFor(cell.span, columns)}
          />
        )}
      />
    </View>
  )
}
