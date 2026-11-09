import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {articleViewLinkFor} from '#/features/news/article/articleLink'
import {useDutchTopicsQuery} from '#/features/news/dutch/queries'
import {useExploreSpread} from '#/features/news/explore/components/ExploreColumn'
import {type RssItem} from '#/features/news/rss/types'
import {type StoredSupplement} from './records'
import {
  localDay,
  type Supplement,
  type SupplementArticle,
  type SupplementStatus,
  supplementStatus,
} from './supplement'

/** A calendar day in the reader's language, at their midnight rather than UTC's. */
function useFormatDay() {
  const {i18n} = useLingui()
  return (day: string) =>
    i18n.date(new Date(`${day}T00:00:00`), {dateStyle: 'long'})
}

export function useSupplementDates() {
  const {t: l} = useLingui()
  const formatDay = useFormatDay()
  return ({startDate, endDate}: Pick<Supplement, 'startDate' | 'endDate'>) => {
    const start = formatDay(startDate)
    if (!endDate) return l`Since ${start}`
    const end = formatDay(endDate)
    return startDate === endDate ? start : `${start} – ${end}`
  }
}

/** The topic in the reader's language, or as it was named when it was picked. */
export function useTopicName() {
  const {topics} = useDutchTopicsQuery()
  const names = new Map(topics.map(topic => [topic.slug, topic.name]))
  return (topic: Supplement['topic']) => names.get(topic.slug) ?? topic.name
}

export function StatusTag({status}: {status: SupplementStatus}) {
  const t = useTheme()
  if (status === 'current') return null
  return (
    <View
      style={[
        a.self_start,
        a.rounded_xs,
        a.px_xs,
        a.py_2xs,
        t.atoms.bg_contrast_50,
      ]}>
      <Text style={[a.text_2xs, a.font_medium, t.atoms.text_contrast_high]}>
        {status === 'archived' ? (
          <Trans context="A supplement past its end date">Archived</Trans>
        ) : (
          <Trans context="A supplement before its start date">Upcoming</Trans>
        )}
      </Text>
    </View>
  )
}

function Thumbnail({uri, ratio}: {uri?: string; ratio: number}) {
  const t = useTheme()
  if (!uri)
    return (
      <View
        style={[
          a.w_full,
          a.rounded_sm,
          t.atoms.bg_contrast_50,
          {aspectRatio: ratio},
        ]}
      />
    )
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{uri}}
      contentFit="cover"
      style={[a.w_full, a.rounded_sm, {aspectRatio: ratio}]}
    />
  )
}

/** A supplement in the list: its first article's image, title, topic and dates. */
export function SupplementCard({stored}: {stored: StoredSupplement}) {
  const t = useTheme()
  const {supplement} = stored
  const dates = useSupplementDates()
  const topicName = useTopicName()
  return (
    <Link
      testID={`supplementCard-${stored.rkey}`}
      to={{
        screen: 'Supplement',
        params: {name: stored.did, rkey: stored.rkey},
      }}
      label={supplement.title}
      style={[a.flex_1, a.flex_col, a.align_stretch, a.gap_sm, a.rounded_0]}>
      <Thumbnail uri={supplement.items[0]?.imageUrl} ratio={16 / 9} />
      <View style={[a.gap_xs]}>
        <StatusTag status={supplementStatus(supplement, localDay())} />
        <Text style={[a.text_lg, a.font_bold, a.leading_snug]}>
          {supplement.title}
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {topicName(supplement.topic)} · {dates(supplement)}
        </Text>
      </View>
    </Link>
  )
}

/** One article, opening the article view with its discussion. */
export function ArticleCard({
  article,
  lead,
  footer,
}: {
  article: SupplementArticle
  /** The first article: wider, with a larger headline and its summary. */
  lead?: boolean
  /** The editor's controls, outside the link. */
  footer?: React.ReactNode
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const {wide} = useExploreSpread()
  const item: RssItem = {
    id: article.url,
    title: article.title,
    link: article.url,
    publishedAt: article.publishedAt,
    description: article.summary,
    imageUrl: article.imageUrl,
  }
  return (
    <View style={[a.flex_1, a.gap_sm]}>
      <Link
        to={articleViewLinkFor(item, article.outlet)}
        label={article.title}
        style={[a.flex_col, a.align_stretch, a.gap_sm, a.rounded_0]}>
        <Thumbnail
          uri={article.imageUrl}
          ratio={lead ? (wide ? 3 : 2) : 16 / 9}
        />
        <View style={[a.gap_xs]}>
          <Text
            style={[a.text_xs, a.font_medium, t.atoms.text_contrast_medium]}>
            {article.outlet.name}
            {article.publishedAt
              ? ` · ${i18n.date(new Date(article.publishedAt), {
                  dateStyle: 'medium',
                })}`
              : ''}
          </Text>
          <Text
            style={[
              lead ? a.text_2xl : a.text_md,
              a.font_bold,
              a.leading_snug,
            ]}>
            {article.title}
          </Text>
          {lead && !!article.summary && (
            <Text
              numberOfLines={3}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_high]}>
              {article.summary}
            </Text>
          )}
        </View>
      </Link>
      {footer}
    </View>
  )
}

/** `items` in rows of `columns`, a short last row keeping its column widths. */
export function Rows<T>({
  items,
  columns,
  keyOf,
  children,
}: {
  items: T[]
  columns: number
  keyOf: (item: T) => string
  children: (item: T) => React.ReactNode
}) {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns))
  }
  return (
    <View style={[a.gap_xl]}>
      {rows.map(row => (
        <View key={row.map(keyOf).join(' ')} style={[a.flex_row, a.gap_lg]}>
          {row.map(item => (
            <View key={keyOf(item)} style={[a.flex_1, {minWidth: 0}]}>
              {children(item)}
            </View>
          ))}
          {Array.from({length: columns - row.length}, (_, index) => (
            <View key={`empty-${index}`} style={[a.flex_1]} />
          ))}
        </View>
      ))}
    </View>
  )
}
