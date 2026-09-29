import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {getPublisherName} from '../../publishers'
import {type ArticleSharers} from '../../queries'
import {type ExploreArticle, outletProfile} from '../cluster'

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
  const {did, name: outletName, id} = article.publisher
  const name = getPublisherName(profile) || outletName || id

  const label = (
    <Text
      emoji
      numberOfLines={1}
      style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
      {name}
    </Text>
  )

  /*
   * An outlet with no Bluesky account has no newsroom page to open and no
   * avatar to show, so it is credited in text alone rather than as a dead link.
   */
  if (!did) {
    return <View style={[a.flex_row, a.align_center]}>{label}</View>
  }

  return (
    <Link
      to={`/newsroom/${did}`}
      label={l`Open the ${name} newsroom`}
      style={[a.flex_row, a.align_center, a.gap_xs]}>
      <UserAvatar type="user" size={16} avatar={profile?.avatar} />
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
   * Only outlets with a real avatar are stacked. Most feed-only outlets have
   * no Bluesky account to take one from, and a row of placeholder silhouettes
   * says nothing the named line beside it does not.
   */
  const avatars = (others.length > 0 ? others : outlets)
    .map(article => ({
      article,
      avatar: outletProfile(profiles, article.publisher)?.avatar,
    }))
    .filter(entry => !!entry.avatar)
    .slice(0, 4)

  return (
    <View style={[a.flex_shrink, a.flex_row, a.align_center, a.gap_xs]}>
      {avatars.length > 0 && (
        <View style={[a.flex_row, a.align_center]}>
          {avatars.map(({article, avatar}, index) => (
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
              <UserAvatar type="user" size={18} avatar={avatar} />
            </View>
          ))}
        </View>
      )}
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
