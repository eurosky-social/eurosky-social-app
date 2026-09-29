import {useState} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {ScrollProvider, useScrollHandlers} from '#/lib/ScrollContext'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {atoms as a, native, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsGear} from '#/components/icons/SettingsGear2'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/newsrooms/explore/components/ExploreColumn'
import {NewsroomHubTabs} from '#/features/newsrooms/hub/NewsroomHubTabs'
import {useCollapsingTitle} from '#/features/newsrooms/hub/useCollapsingTitle'
import {selectSources} from '../sources'
import {type NewsFeedPrefs} from '../state/prefs'
import {NewsFeedRailColumn} from './NewsFeedRailColumn'

export function NewsFeedTab({
  prefs,
  onEdit,
}: {
  prefs: NewsFeedPrefs
  onEdit: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const dids = selectSources({
    topics: prefs.topics,
    regions: prefs.regions,
    excludedDids: prefs.excludedDids,
  }).map(source => source.did)
  const feed = `newsfeed|${dids.join(',')}` as FeedDescriptor

  const {wide} = useExploreSpread()
  /** Height of the pinned header and tabs, which the right column sits under. */
  const [chromeHeight, setChromeHeight] = useState(0)
  const titleCollapse = useCollapsingTitle()
  const parentScrollHandlers = useScrollHandlers()

  const headerContent = (
    <>
      <Layout.Header.BackButton />
      <Layout.Header.Content>
        <Layout.Header.TitleText>
          <Trans>Mu News</Trans>
        </Layout.Header.TitleText>
      </Layout.Header.Content>
      {/* Outside Header.Slot: slots are fixed-width squares and this button
       * carries a text label. */}
      <Button
        testID="newsFeedEditBtn"
        label={l`Customize news feed`}
        size="small"
        color="secondary"
        onPress={onEdit}>
        <ButtonIcon icon={SettingsGear} />
        <ButtonText>
          <Trans>Configure</Trans>
        </ButtonText>
      </Button>
    </>
  )

  /*
   * The header and tabs pin together above the feed on every screen size. On
   * a wide web layout they run the width of the spread, as on the hub's other
   * pages, with the feed and the page's own right column below them.
   */
  return (
    <Layout.Screen testID="newsFeedScreen" noCenterBorders={wide}>
      {wide && <ExploreSpreadBorders />}
      <View
        pointerEvents="box-none"
        style={[web([a.sticky, {top: 0}]), native(a.overflow_hidden), a.z_10]}
        onLayout={
          wide
            ? event => setChromeHeight(event.nativeEvent.layout.height)
            : undefined
        }>
        <Animated.View style={titleCollapse.blockStyle}>
          {wide ? (
            <>
              <ExploreHeaderOuter>{headerContent}</ExploreHeaderOuter>
              <ExploreColumn style={[t.atoms.bg]}>
                <NewsroomHubTabs active="mine" />
              </ExploreColumn>
            </>
          ) : (
            <>
              <View onLayout={titleCollapse.onTitleLayout}>
                <Layout.Header.Outer>{headerContent}</Layout.Header.Outer>
              </View>
              <Layout.Center style={[t.atoms.bg]}>
                <NewsroomHubTabs active="mine" />
              </Layout.Center>
            </>
          )}
        </Animated.View>
      </View>
      {/* Relative, so the right column can run the feed's full height and
       * stick within it. */}
      <View style={[a.relative, a.flex_1]}>
        {dids.length === 0 ? (
          <NoSources onEdit={onEdit} />
        ) : (
          /* Passes the feed's native scroll on to the title collapse, while
           * keeping the shell's own handlers (which hide its bottom bar). */
          <ScrollProvider
            {...parentScrollHandlers}
            onScroll={(event, context) => {
              'worklet'
              parentScrollHandlers.onScroll?.(event, context)
              titleCollapse.onScroll(event)
            }}>
            <PostFeed
              testID="newsFeed"
              feed={feed}
              renderEmptyState={renderEmpty}
            />
          </ScrollProvider>
        )}
        {wide && <NewsFeedRailColumn top={chromeHeight} />}
      </View>
    </Layout.Screen>
  )
}

function renderEmpty() {
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.p_2xl]}>
      <Text style={[a.text_md, a.text_center]}>
        <Trans>No recent posts from your news sources.</Trans>
      </Text>
    </View>
  )
}

function NoSources({onEdit}: {onEdit: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Layout.Center
      style={[a.flex_1, a.align_center, a.justify_center, a.p_2xl, a.gap_lg]}>
      <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
        <Trans>None of your news sources match the topics you picked.</Trans>
      </Text>
      <Button
        label={l`Customize news feed`}
        size="small"
        color="secondary"
        onPress={onEdit}>
        <ButtonText>
          <Trans>Adjust topics</Trans>
        </ButtonText>
      </Button>
    </Layout.Center>
  )
}
