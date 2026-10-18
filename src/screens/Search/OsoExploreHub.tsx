import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useGetTrendsQuery} from '#/state/queries/trending/useGetTrendsQuery'
import {SearchAutocompleteInput} from '#/screens/Search/components/SearchAutocompleteInput'
import {
  TrendingTopicRowSkeleton,
  TrendRow,
} from '#/screens/Search/modules/ExploreTrendingTopics'
import {StarterPackRow} from '#/screens/StarterPack/OsoStarterPacks'
import {useOsoStarterPackUris} from '#/screens/StarterPack/OsoStarterPacks/useOsoStarterPackUris'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {OsoDiscoverFeeds} from '#/features/osoFeeds/DiscoverFeeds'
import {OsoTitlePill} from '#/features/osoNav/pills'
import {OsoSectionHeader} from '#/features/osoNav/SectionHeader'

/** Each preview section shows this many items before "show more". */
const PREVIEW_COUNT = 3

/**
 * Oso's explore page: a search bar, then a preview of starter packs, feeds to
 * discover and popular topics. Shown on /search when there is no query.
 */
export function OsoExploreHub() {
  const navigation = useNavigation<NavigationProp>()
  const [query, setQuery] = useState('')

  return (
    <Layout.Screen testID="osoExploreHub">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          {/* Titled with the same pill as the explore button in the menu. */}
          <OsoTitlePill kind="explore" />
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.px_lg, a.pt_lg]} testID="osoExploreSearch">
          {/* Suggests people as you type, like the search page does. */}
          <SearchAutocompleteInput
            value={query}
            onChangeText={setQuery}
            onClearText={() => setQuery('')}
            onSubmitEditing={() => {
              const q = query.trim()
              if (q) navigation.push('Search', {q})
            }}
            onSelectProfile={profile =>
              navigation.navigate('Profile', {name: profile.handle})
            }
            onSelectSearch={value => {
              const q = value.trim()
              if (q) navigation.push('Search', {q})
            }}
          />
        </View>
        <StarterPacksSection />
        <OsoDiscoverFeeds />
        <PopularSection />
        <View style={{height: 100}} />
      </Layout.Content>
    </Layout.Screen>
  )
}

/** The first few starter packs, with a link to the full list. */
function StarterPacksSection() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {uris, isLoading, hasNextPage} = useOsoStarterPackUris()
  const hasMore = uris.length > PREVIEW_COUNT || hasNextPage

  return (
    <View>
      <OsoSectionHeader kind="starterPacks" to="/starter-packs" />
      {isLoading ? null : uris.length === 0 ? (
        <Text style={[a.px_lg, a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>No starter packs yet.</Trans>
        </Text>
      ) : (
        uris
          .slice(0, PREVIEW_COUNT)
          .map(uri => <StarterPackRow key={uri} uri={uri} />)
      )}
      {hasMore && (
        <ShowMoreLink to="/starter-packs" label={l`Show more starter packs`} />
      )}
    </View>
  )
}

/** The top popular topics, with a link to the popular page. */
function PopularSection() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data, isLoading, error} = useGetTrendsQuery({limit: 5})
  const trends = data?.trends ?? []

  return (
    <View>
      <OsoSectionHeader kind="trending" to="/trending" />
      {isLoading ? (
        Array.from({length: PREVIEW_COUNT}).map((_, i) => (
          <TrendingTopicRowSkeleton key={i} />
        ))
      ) : error || trends.length === 0 ? (
        <Text style={[a.px_lg, a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>Nothing is popular right now.</Trans>
        </Text>
      ) : (
        trends
          .slice(0, PREVIEW_COUNT)
          .map((trend, index) => (
            <TrendRow
              key={trend.link}
              trend={trend}
              rank={index + 1}
              recId={data?.recId}
            />
          ))
      )}
      {trends.length > PREVIEW_COUNT && (
        <ShowMoreLink to="/trending" label={l`Show more popular topics`} />
      )}
    </View>
  )
}

function ShowMoreLink({to, label}: {to: string; label: string}) {
  return (
    <View style={[a.px_lg, a.pt_sm, a.pb_md]}>
      <InlineLinkText
        to={to}
        label={label}
        style={[a.text_md, a.font_semi_bold]}>
        {label}
      </InlineLinkText>
    </View>
  )
}
