import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type ExploreSourceId, outletProfile} from '../explore/cluster'
import {BandRule, KickerText} from '../explore/components/Rules'
import {PublisherLabel} from '../explore/components/StoryByline'
import {useFrontpageProfilesQuery} from '../queries'
import {articleViewLink} from './articleLink'
import {useStoryCoverage} from './useStoryCoverage'

/**
 * The other outlets' versions of the story being read: each outlet with its
 * headline, so the reader can see how the same event was told elsewhere and
 * move across to it without going back to the spread.
 *
 * Set like the rest of the article's right column (rules and headlines, no
 * boxes). On screens with no right column it runs under the article instead.
 */
export function ArticleCoverage({
  url,
  storyId,
  storySource,
  storyView,
  inline = false,
}: {
  /** The article being read, left out of the list. */
  url: string
  storyId?: string
  storySource?: ExploreSourceId
  storyView?: string
  /** Under the article, rather than in the right column. */
  inline?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const timeAgo = useGetTimeAgo()
  const profiles = useFrontpageProfilesQuery()
  const {story, coverage} = useStoryCoverage({
    url,
    storyId,
    storySource,
    storyView,
  })

  const others = coverage.filter(article => article.item.link !== url)
  if (others.length === 0) return null

  return (
    <View style={[a.px_lg, inline ? a.pb_lg : a.pt_2xl, a.gap_md]}>
      <KickerText>
        {l({
          message: 'Other coverage',
          comment:
            'Heading over other news outlets’ articles about the same story',
        })}
      </KickerText>
      <BandRule />

      {others.map(article => {
        const published = article.item.publishedAt
          ? new Date(article.item.publishedAt)
          : undefined
        return (
          <View key={article.item.link} style={[a.gap_xs]}>
            <PublisherLabel
              article={article}
              profile={outletProfile(profiles, article.publisher)}
            />
            <Link
              to={articleViewLink(article, story)}
              label={article.item.title}
              style={[a.flex_col, a.align_start, a.w_full]}>
              <Text
                numberOfLines={3}
                style={[a.text_sm, a.font_bold, a.leading_snug, t.atoms.text]}>
                {article.item.title}
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
    </View>
  )
}
