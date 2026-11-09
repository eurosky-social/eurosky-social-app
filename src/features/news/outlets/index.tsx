import {View} from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a, native, useBreakpoints, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useFrontpageProfiles} from '#/features/frontpages/frontpages'
import {
  ExploreColumn,
  ExploreSpreadBorders,
  useExploreSpread,
} from '../explore/components/ExploreColumn'
import {NewsHubHeader} from '../hub/NewsHubHeader'
import {useCollapsingTitle} from '../hub/useCollapsingTitle'
import {OutletArticlesCard} from './components/OutletArticlesCard'
import {type FeaturedOutlet, useFeaturedOutlets} from './featured'

/**
 * The hub's outlets tab: every featured outlet as a card of its latest
 * articles - the configured ones first, then the publisher's newsrooms - three
 * across on a wide screen. The full directory, by country, is a link away.
 */
export function NewsOutletsScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'NewsOutlets'>,
) {
  const {t: l} = useLingui()
  const {wide} = useExploreSpread()
  const {gtMobile} = useBreakpoints()
  const {outlets, isLoading} = useFeaturedOutlets()
  const profiles = useFrontpageProfiles(outlets)
  const titleCollapse = useCollapsingTitle()
  const titleScrollHandler = useAnimatedScrollHandler(event => {
    titleCollapse.onScroll(event)
  })
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))

  const columns = wide ? 3 : gtMobile ? 2 : 1

  return (
    <Layout.Screen testID="newsOutletsScreen" noCenterBorders>
      <ExploreSpreadBorders />
      {/* The header pins outside the scroll view: on web the window scrolls,
       * which a sticky header inside it cannot follow. */}
      <View
        pointerEvents="box-none"
        style={[web([a.sticky, {top: 0}]), native(a.overflow_hidden), a.z_10]}>
        <Animated.View style={titleCollapse.blockStyle}>
          <View onLayout={titleCollapse.onTitleLayout}>
            <NewsHubHeader active="outlets" />
          </View>
        </Animated.View>
      </View>

      <Animated.ScrollView
        style={scrollStyle}
        onScroll={titleScrollHandler}
        scrollEventThrottle={16}>
        <ExploreColumn>
          {isLoading ? (
            <View style={[a.p_2xl, a.align_center]}>
              <Loader size="lg" />
            </View>
          ) : outlets.length === 0 ? (
            <View style={[a.p_2xl, a.align_center]}>
              <Text style={[a.text_md, a.text_center]}>
                <Trans>No featured outlets right now.</Trans>
              </Text>
            </View>
          ) : (
            <View style={[a.px_lg, a.py_lg, a.gap_md]}>
              {rowsOf(outlets, columns).map(row => (
                <View
                  key={row.map(outlet => outlet.slug).join(',')}
                  style={[a.flex_row, a.align_stretch, a.gap_md]}>
                  {row.map(outlet => (
                    <OutletArticlesCard
                      key={outlet.slug}
                      outlet={outlet}
                      profile={
                        outlet.did ? profiles.get(outlet.did) : undefined
                      }
                    />
                  ))}
                  {/* Keeps a short last row in its columns instead of
                   * letting its cards stretch across the width. */}
                  {Array.from({length: columns - row.length}, (_, index) => (
                    <View key={`empty-${index}`} style={[a.flex_1]} />
                  ))}
                </View>
              ))}
            </View>
          )}
          <View style={[a.px_lg, a.pb_2xl, a.align_center]}>
            <InlineLinkText
              to="/outlets"
              label={l`Browse every outlet`}
              style={[a.text_sm]}>
              <Trans>Browse every outlet</Trans>
            </InlineLinkText>
          </View>
        </ExploreColumn>
      </Animated.ScrollView>
    </Layout.Screen>
  )
}

/** The outlets in rows of `columns`. */
function rowsOf(
  outlets: FeaturedOutlet[],
  columns: number,
): FeaturedOutlet[][] {
  const rows: FeaturedOutlet[][] = []
  for (let i = 0; i < outlets.length; i += columns) {
    rows.push(outlets.slice(i, i + columns))
  }
  return rows
}
