import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigationState} from '@react-navigation/native'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {getCurrentRoute} from '#/lib/routes/helpers'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {InlineLinkText, Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {
  findFrontpage,
  type Frontpage,
  frontpagePath,
  useFrontpages,
} from '#/features/frontpages/frontpages'
import {articleItem} from '../dutch/adapt'
import {useDutchOutletArticlesQuery} from '../dutch/queries'
import {BandRule, KickerText} from '../explore/components/Rules'
import {getPublisherName} from '../publishers'
import {ArticleCoverage} from './ArticleCoverage'
import {articleViewLinkFor} from './articleLink'

/** How many other pieces the rail lists. */
const SHOWN = 6

/**
 * The focused article's right column: the other outlets' coverage of the same
 * story, then more of the same outlet's recent journalism. Both are set as a
 * continuation of the page rather than as boxed widgets - the same
 * rules-and-headlines grammar as the explore spread, so the column reads as one
 * more department of it.
 *
 * It reads the focused article from the navigation state (like the frontpage
 * rail does) rather than taking a prop, since the shell owns the right column.
 * Coverage needs the story the article was opened from; "more from" needs the
 * outlet to be a frontpage, one of the news aggregator's outlets. With neither,
 * the column stays empty.
 */
export function NewsArticleRightRail() {
  const rawParams = useNavigationState(state => {
    if (!state) return undefined
    const route = getCurrentRoute(state)
    if (route.name !== 'NewsArticle') return undefined
    return route.params
  })
  const params = rawParams as CommonNavigatorParams['NewsArticle'] | undefined

  const {frontpages} = useFrontpages()
  const frontpage = findFrontpage(
    frontpages,
    params?.outletSlug ?? params?.outletDid,
  )

  if (!params) return null

  return (
    <>
      <ArticleCoverage
        url={params.url}
        storyId={params.storyId}
        storySource={params.storySource}
        storyView={params.storyView}
      />
      {frontpage && (
        <MoreFromFrontpage frontpage={frontpage} currentUrl={params.url} />
      )}
    </>
  )
}

function MoreFromFrontpage({
  frontpage,
  currentUrl,
}: {
  frontpage: Frontpage
  currentUrl?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const timeAgo = useGetTimeAgo()
  const {data: profile} = useProfileQuery({did: frontpage.did})
  /* The same query as its frontpage's articles, so opening the frontpage is instant. */
  const {data} = useDutchOutletArticlesQuery({slug: frontpage.slug})
  const articles = data?.map(articleItem)

  const name = getPublisherName(profile) || frontpage.name
  // Drop the piece being read; it is already the whole page above.
  const others = (articles ?? [])
    .filter(item => item.link !== currentUrl)
    .slice(0, SHOWN)

  if (others.length === 0) return null

  return (
    <View style={[a.px_lg, a.pt_2xl, a.gap_md]}>
      <KickerText>
        {name ? l`More from ${name}` : l`More from this outlet`}
      </KickerText>
      <BandRule />

      {others.map(item => {
        const published = item.publishedAt
          ? new Date(item.publishedAt)
          : undefined
        return (
          <View key={item.id} style={[a.gap_2xs]}>
            <Link
              to={articleViewLinkFor(item, {
                did: frontpage.did,
                name,
                slug: frontpage.slug,
              })}
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
        to={frontpagePath(frontpage)}
        label={l`Open the frontpage`}
        style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
        {l`See the frontpage`}
      </InlineLinkText>
    </View>
  )
}
