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
  postCount,
}: {
  article: ExploreArticle
  /** Posts in the Atmosphere featuring the article, where they are known. */
  postCount?: number
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const timeAgo = useGetTimeAgo()
  const published = article.item.publishedAt
    ? new Date(article.item.publishedAt)
    : undefined

  if (!published && !postCount) return null

  return (
    <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
      {!!published &&
        (isRecent(published)
          ? timeAgo(published, Date.now())
          : i18n.date(published, {dateStyle: 'medium'}))}
      {!!published && !!postCount && ' · '}
      {!!postCount && plural(postCount, {one: '# post', other: '# posts'})}
    </Text>
  )
}

/**
 * The other newsrooms on the same story, as their avatars plus a count. Reads
 * as one object - the overlap says "these outlets, one story" - and is the
 * page's whole reason to cluster.
 */
export function CoverageStack({
  articles,
  profiles,
}: {
  /** The story's other coverage, excluding the article being labelled. */
  articles: ExploreArticle[]
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
}) {
  const t = useTheme()

  if (articles.length === 0) return null

  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs]}>
      <View style={[a.flex_row, a.align_center]}>
        {articles.slice(0, 4).map((article, index) => (
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
            <UserAvatar
              type="user"
              size={18}
              avatar={outletProfile(profiles, article.publisher)?.avatar}
            />
          </View>
        ))}
      </View>
      <Text style={[a.text_xs, a.font_bold, {color: t.palette.primary_500}]}>
        {plural(articles.length, {
          one: 'Full coverage · # newsroom',
          other: 'Full coverage · # newsrooms',
        })}
      </Text>
    </View>
  )
}

/** Within a day, relative time reads better than a date. */
function isRecent(date: Date): boolean {
  return Date.now() - date.getTime() < 24 * 60 * 60 * 1000
}
