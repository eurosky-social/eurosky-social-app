import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {newsroomPath} from '../../newsrooms'
import {getPublisherName} from '../../publishers'
import {type ArticleSharers} from '../../queries'
import {type ExploreArticle, outletProfile} from '../cluster'
import {OutletIcon} from './OutletIcon'

/**
 * The newsroom that ran a story, set above its headline the way a news app
 * credits a source. The spread mixes outlets in one column, so attribution
 * comes before the headline rather than after it.
 *
 * It is also the way into that newsroom's own page, so it is a link in its own
 * right - which is why it always sits outside the headline's link rather than
 * inside it.
 */
export function PublisherLabel({
  article,
  profile,
}: {
  article: ExploreArticle
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {slug, name: outletName, id} = article.publisher
  const name = getPublisherName(profile) || outletName || id

  const label = (
    <Text
      emoji
      numberOfLines={1}
      style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
      {name}
    </Text>
  )

  const icon = (
    <OutletIcon outlet={article.publisher} profile={profile} size={16} />
  )

  /*
   * Every one of the news aggregator's outlets has a newsroom, found by its
   * slug. An RSS outlet has none to open, so it is credited without a link
   * rather than with a dead one.
   */
  if (!slug) {
    return (
      <View style={[a.flex_row, a.align_center, a.gap_xs]}>
        {icon}
        {label}
      </View>
    )
  }

  return (
    <Link
      to={newsroomPath({slug})}
      label={l`Open the ${name} newsroom`}
      style={[a.flex_row, a.align_center, a.gap_xs]}>
      {icon}
      {label}
    </Link>
  )
}

/**
 * When a story ran, and how much of a conversation it has drawn. Sits under the
 * headline, quiet enough to skip while scanning.
 */
export function StoryMeta({
  article,
  sharers,
}: {
  article: ExploreArticle
  /** People in the Atmosphere who shared the article, where they are known. */
  sharers?: ArticleSharers
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const timeAgo = useGetTimeAgo()
  const published = article.item.publishedAt
    ? new Date(article.item.publishedAt)
    : undefined

  const sharedBy = sharers?.count ? sharedByLabel(sharers) : undefined

  if (!published && !sharedBy) return null

  return (
    <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
      {!!published &&
        (isRecent(published)
          ? timeAgo(published, Date.now())
          : i18n.date(published, {dateStyle: 'medium'}))}
      {!!published && !!sharedBy && '\u00a0– '}
      {sharedBy}
    </Text>
  )
}

/**
 * The other newsrooms on the same story: their avatars, and a line naming the
 * first of them. Names say more than a count - which outlets, not just how
 * many - and the overlap of avatars says "these outlets, one story".
 */
export function CoverageStack({
  articles,
  leadOutletId,
  newsroomCount,
  profiles,
}: {
  /** The story's other coverage, excluding the article being labelled. */
  articles: ExploreArticle[]
  /** The labelled article's outlet, which the line never names as "more". */
  leadOutletId: string
  /**
   * Distinct outlets on the whole story, the labelled article's included. A
   * source may count outlets beyond the articles it hands over, so this can
   * exceed what is in `articles`; the difference is the "and N more".
   */
  newsroomCount: number
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  if (articles.length === 0) return null

  /*
   * One outlet can run a story several times (a follow-up, a translation), so
   * each outlet is shown and named once.
   */
  const outlets = articles.filter(
    (article, index) =>
      articles.findIndex(
        other => other.publisher.id === article.publisher.id,
      ) === index,
  )
  const others = outlets.filter(
    article => article.publisher.id !== leadOutletId,
  )
  const [first, second] = others
    .slice(0, NAMED_OUTLETS)
    .map(article => outletName(article, profiles))
  const unnamed = Math.max(
    0,
    Math.max(newsroomCount - 1, others.length) - (second ? 2 : first ? 1 : 0),
  )

  let text: string
  if (!first) {
    text = plural(articles.length, {
      one: '# more article on this',
      other: '# more articles on this',
    })
  } else if (unnamed === 0) {
    text = second
      ? l`${first} and ${second} covered this too`
      : l`${first} covered this too`
  } else {
    text = second
      ? plural(unnamed, {
          one: `${first}, ${second} and # more covered this`,
          other: `${first}, ${second} and # more covered this`,
        })
      : plural(unnamed, {
          one: `${first} and # more covered this`,
          other: `${first} and # more covered this`,
        })
  }

  /*
   * Every outlet gets a bubble: OutletIcon finds a logo for most of them (the
   * Bluesky avatar, else the site's own icon) and falls back to an initial, so
   * the stack still reads as "these outlets" where no logo exists.
   */
  const bubbles = (others.length > 0 ? others : outlets).slice(0, MAX_BUBBLES)

  return (
    <View style={[a.flex_shrink, a.flex_row, a.align_center, a.gap_xs]}>
      <View style={[a.flex_row, a.align_center]}>
        {bubbles.map((article, index) => (
          <View
            key={article.publisher.id}
            style={[
              a.rounded_full,
              a.border,
              t.atoms.bg,
              {
                borderColor: t.atoms.bg.backgroundColor,
                marginLeft: index === 0 ? 0 : -6,
              },
            ]}>
            <OutletIcon
              outlet={article.publisher}
              profile={outletProfile(profiles, article.publisher)}
              size={18}
            />
          </View>
        ))}
      </View>
      <Text
        emoji
        numberOfLines={2}
        style={[
          a.flex_shrink,
          a.text_xs,
          a.font_bold,
          {color: t.palette.primary_500},
        ]}>
        {text}
      </Text>
    </View>
  )
}

/** "Shared by 3 people", or "Shared by 25+ people" where that is a floor. */
export function sharedByLabel(sharers: ArticleSharers): string {
  return sharers.partial
    ? plural(sharers.count, {
        one: 'Shared by #+ people',
        other: 'Shared by #+ people',
      })
    : plural(sharers.count, {
        one: 'Shared by # person',
        other: 'Shared by # people',
      })
}

/** Outlets named in the coverage line before the rest become a count. */
const NAMED_OUTLETS = 2

/** Outlets stacked as bubbles beside the coverage line. */
const MAX_BUBBLES = 4

/** An outlet's display name: its live profile's, else the source's, else its id. */
export function outletName(
  article: ExploreArticle,
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>,
): string {
  const {name, id} = article.publisher
  return (
    getPublisherName(outletProfile(profiles, article.publisher)) || name || id
  )
}

/** Within a day, relative time reads better than a date. */
function isRecent(date: Date): boolean {
  return Date.now() - date.getTime() < 24 * 60 * 60 * 1000
}
