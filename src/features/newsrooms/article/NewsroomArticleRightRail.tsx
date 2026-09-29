import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigationState} from '@react-navigation/native'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {getCurrentRoute} from '#/lib/routes/helpers'
import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {InlineLinkText, Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {BandRule, KickerText} from '../explore/components/Rules'
import {
  getNewsroomPublisherByDid,
  getPublisherName,
  getPublisherRssUrls,
} from '../publishers'
import {useRssArticlesQuery} from '../queries'
import {articleViewLinkFor} from './articleLink'

/** How many other pieces the rail lists. */
const SHOWN = 6

/**
 * The focused article's right column: more of the same outlet's recent
 * journalism, set as a continuation of the page rather than a boxed widget - the
 * same rules-and-headlines grammar as the explore spread, so the column reads as
 * one more department of it.
 *
 * It reads the focused article from the navigation state (like the newsroom
 * rail does) rather than taking a prop, since the shell owns the right column.
 * Only registered publishers have a front page to draw from; for any other
 * outlet the rail renders nothing and the column stays empty.
 */
export function NewsroomArticleRightRail() {
  const rawParams = useNavigationState(state => {
    if (!state) return undefined
    const route = getCurrentRoute(state)
    if (route.name !== 'NewsroomArticle') return undefined
    return route.params
  })
  const params = rawParams as {outletDid?: string; url?: string} | undefined

  const publisher = params?.outletDid
    ? getNewsroomPublisherByDid(params.outletDid)
    : undefined

  if (!publisher) return null

  return (
    <MoreFromPublisher
      did={publisher.did}
      feedUrls={getPublisherRssUrls(publisher)}
      currentUrl={params?.url}
    />
  )
}

function MoreFromPublisher({
  did,
  feedUrls,
  currentUrl,
}: {
  did: string
  feedUrls: string[]
  currentUrl?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const timeAgo = useGetTimeAgo()
  const {data: profile} = useProfileQuery({did})
  const {data: articles} = useRssArticlesQuery({urls: feedUrls})

  const name = getPublisherName(profile)
  // Drop the piece being read; it is already the whole page above.
  const others = (articles ?? [])
    .filter(item => item.link !== currentUrl)
    .slice(0, SHOWN)

  if (others.length === 0) return null

  return (
    <View style={[a.px_lg, a.pt_2xl, a.gap_md]}>
      <KickerText>
        {name ? l`More from ${name}` : l`More from this publisher`}
      </KickerText>
      <BandRule />

      {others.map(item => {
        const published = item.publishedAt
          ? new Date(item.publishedAt)
          : undefined
        return (
          <View key={item.id} style={[a.gap_2xs]}>
            <Link
              to={articleViewLinkFor(item, {did, name})}
              label={item.title}
              style={[a.flex_col, a.align_start, a.w_full]}>
              <Text
                numberOfLines={3}
                style={[a.text_sm, a.font_bold, a.leading_snug, t.atoms.text]}>
                {item.title}
              </Text>
            </Link>
            {!!published && (
              <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                {timeAgo(published, Date.now())}
              </Text>
            )}
            <View style={[a.pt_md]}>
              <BandRule />
            </View>
          </View>
        )
      })}

      <InlineLinkText
        to={`/newsroom/${did}`}
        label={l`Open the newsroom`}
        style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
        {l`See the newsroom`}
      </InlineLinkText>
    </View>
  )
}
