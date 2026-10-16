import {useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useGetTrendsQuery} from '#/state/queries/trending/useGetTrendsQuery'
import {EmptyState} from '#/view/com/util/EmptyState'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {
  TrendingTopicRowSkeleton,
  TrendRow,
} from '#/screens/Search/modules/ExploreTrendingTopics'
import {atoms as a, useTheme} from '#/alf'
import {Trending3_Stroke2_Corner1_Rounded as TrendingIcon} from '#/components/icons/Trending'
import * as Layout from '#/components/Layout'
import {OsoTitlePill} from '#/features/osoNav/pills'

const TOPIC_COUNT = 5

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoTrending'>

/**
 * Oso's trending page, opened from the trending tile on the explore page: the
 * five top trending topics, each linking to its topic feed.
 */
export function OsoTrendingScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {
    data: trending,
    error,
    isLoading,
    refetch,
  } = useGetTrendsQuery({limit: TOPIC_COUNT})

  return (
    <Layout.Screen testID="osoTrendingScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <OsoTitlePill kind="trending" />
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        {isLoading ? (
          Array.from({length: TOPIC_COUNT}).map((_, i) => (
            <TrendingTopicRowSkeleton key={i} />
          ))
        ) : error ? (
          <ErrorMessage
            message={cleanError(error)}
            onPressTryAgain={() => void refetch()}
          />
        ) : trending?.trends.length ? (
          trending.trends.map((trend, index) => (
            <TrendRow
              key={trend.link}
              trend={trend}
              rank={index + 1}
              recId={trending.recId}
            />
          ))
        ) : (
          <EmptyState
            icon={TrendingIcon}
            message={l`Nothing is trending right now`}
            textStyle={[t.atoms.text_contrast_medium, a.font_medium]}
            style={[a.pt_3xl]}
          />
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}
