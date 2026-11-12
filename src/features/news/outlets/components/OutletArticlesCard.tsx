import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {atoms as a, useTheme, web} from '#/alf'
import {InlineLinkText, Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {frontpagePath} from '#/features/frontpages/frontpages'
import {type app} from '#/lexicons'
import {articleViewLinkFor} from '../../article/articleLink'
import {OutletIcon} from '../../explore/components/OutletIcon'
import {getPublisherName} from '../../publishers'
import {type RssItem} from '../../rss/types'
import {OUTLET_CARD_ARTICLES} from '../config'
import {type FeaturedOutlet, useFeaturedOutletArticles} from '../featured'
import {outletIconOf} from './FeaturedOutletCard'

/**
 * An outlet on the outlets tab: its masthead, leading to its frontpage, over
 * its latest articles, each opening the article page.
 */
export function OutletArticlesCard({
  outlet,
  profile,
}: {
  outlet: FeaturedOutlet
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {articles, isLoading} = useFeaturedOutletArticles(
    outlet,
    OUTLET_CARD_ARTICLES,
  )
  const name = getPublisherName(profile) || outlet.name
  const handle = profile?.handle ? `@${profile.handle}` : outlet.site
  const articleOutlet = {did: outlet.did, name, slug: outlet.slug}

  return (
    <View
      testID={`outletCard-${outlet.slug}`}
      style={[
        a.flex_1,
        a.rounded_md,
        a.border,
        a.overflow_hidden,
        t.atoms.border_contrast_low,
        t.atoms.bg,
      ]}>
      <Link
        to={frontpagePath(outlet)}
        label={l`Open ${name}’s front page`}
        style={[
          a.flex_row,
          a.align_center,
          a.gap_md,
          a.px_lg,
          a.py_md,
          a.rounded_0,
          a.border_b,
          t.atoms.border_contrast_low,
          web({cursor: 'pointer'}),
        ]}>
        {({hovered, pressed}) => (
          <>
            <OutletIcon
              outlet={outletIconOf(outlet)}
              profile={profile}
              size={36}
            />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text
                emoji
                numberOfLines={1}
                style={[
                  a.text_md,
                  a.font_bold,
                  a.leading_tight,
                  t.atoms.text,
                  (hovered || pressed) && {textDecorationLine: 'underline'},
                ]}>
                {name}
              </Text>
              {!!handle && (
                <Text
                  numberOfLines={1}
                  style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {handle}
                </Text>
              )}
            </View>
          </>
        )}
      </Link>

      <View style={[a.flex_1, a.px_lg]}>
        {isLoading ? (
          <View style={[a.py_xl, a.align_center]}>
            <Loader size="md" />
          </View>
        ) : !articles?.length ? (
          <Text style={[a.py_lg, a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>No recent articles.</Trans>
          </Text>
        ) : (
          articles.map((item, index) => (
            <ArticleRow
              key={item.id}
              item={item}
              outlet={articleOutlet}
              first={index === 0}
            />
          ))
        )}
      </View>

      <View style={[a.px_lg, a.py_md, a.border_t, t.atoms.border_contrast_low]}>
        <InlineLinkText
          to={frontpagePath(outlet)}
          label={l`Open ${name}’s front page`}
          style={[a.text_sm, a.font_medium]}>
          <Trans>Open front page</Trans>
        </InlineLinkText>
      </View>
    </View>
  )
}

function ArticleRow({
  item,
  outlet,
  first,
}: {
  item: RssItem
  outlet: {did?: string; name?: string; slug?: string}
  first: boolean
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const timeAgo = useGetTimeAgo()
  const published = item.publishedAt ? new Date(item.publishedAt) : undefined

  return (
    <Link
      to={articleViewLinkFor(item, outlet)}
      label={item.title}
      style={[
        a.flex_col,
        a.align_start,
        a.gap_2xs,
        a.py_md,
        a.rounded_0,
        !first && [a.border_t, t.atoms.border_contrast_low],
        web({cursor: 'pointer'}),
      ]}>
      {({hovered, pressed}) => (
        <>
          <Text
            emoji
            numberOfLines={3}
            style={[
              a.text_sm,
              a.font_semi_bold,
              a.leading_snug,
              t.atoms.text,
              (hovered || pressed) && {textDecorationLine: 'underline'},
            ]}>
            {item.title}
          </Text>
          {!!published && (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {Date.now() - published.getTime() < 24 * 60 * 60 * 1000
                ? timeAgo(published, Date.now())
                : i18n.date(published, {dateStyle: 'medium'})}
            </Text>
          )}
        </>
      )}
    </Link>
  )
}
