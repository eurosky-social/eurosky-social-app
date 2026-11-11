import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type PostArticle} from '#/features/articles/articles'
import {cardHasMedia} from '../model'
import {NewsCard} from '../NewsCard'
import {type FrontSection, latestGroups} from '../sections'
import {
  cardSizeFor,
  type Columns,
  planShapes,
  reflowRows,
  type Span,
} from '../slotting'
import {useFrontPageRows} from '../useFrontPageRows'
import {Row} from './index'
import {SectionHeading} from './SectionHeading'
import {useFrontPageColumns} from './useFrontPageColumns'
import {useFrozenSections} from './useFrozenSections'

const TOP: Span[][] = [[3], [2, 1], [1, 1, 1]]
const TWO_ROWS: Span[][] = [
  [2, 1],
  [1, 1, 1],
]
const ONE_ROW: Span[][] = [[1, 1, 1]]

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
  mode: 'discover' | 'following'
  shorts?: React.ReactNode
  /** The feed has no more pages; build sections from what there is. */
  complete?: boolean
}) {
  const t = useTheme()
  const columns = useFrontPageColumns()
  const sections = useFrozenSections(articles, mode, !!shorts, complete)
  return (
    <View testID="sectionedFrontPage">
      {sections.map(section =>
        section.kind === 'shorts' ? (
          <View
            key="shorts"
            testID="frontPageShorts"
            style={[
              a.mt_lg,
              {borderTopWidth: 2},
              t.atoms.border_contrast_high,
            ]}>
            {shorts}
          </View>
        ) : section.kind === 'latest' ? (
          <Latest key="latest" articles={section.articles} columns={columns} />
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
  const shapes =
    section.kind === 'top'
      ? TOP
      : section.kind === 'popular' || section.kind === 'video'
        ? TWO_ROWS
        : ONE_ROW
  const rows = reflowRows(
    planShapes(section.articles.map(cardHasMedia), shapes),
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
      {rows.map(
        row =>
          row.type === 'cards' && (
            <Row
              key={section.articles[row.cells[0].index].item.uri}
              row={row}
              columns={columns}
              renderCell={cell => (
                <NewsCard
                  article={section.articles[cell.index]}
                  size={cardSizeFor(cell.span, columns)}
                />
              )}
            />
          ),
      )}
    </View>
  )
}

function Latest({
  articles,
  columns,
}: {
  articles: readonly PostArticle[]
  columns: Columns
}) {
  const {t: l} = useLingui()
  if (!articles.length) return null
  return (
    <View testID="section-latest">
      <SectionHeading id="latest" title={l`Latest`} />
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
    articles.map(cardHasMedia),
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
          a.text_sm,
          a.font_semi_bold,
          t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
      {rows.map(
        row =>
          row.type === 'cards' && (
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
