import {useState} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {ScrollProvider, useScrollHandlers} from '#/lib/ScrollContext'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {atoms as a, native, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsGear} from '#/components/icons/SettingsGear2'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/news/explore/components/ExploreColumn'
import {NewsHubHeader} from '#/features/news/hub/NewsHubHeader'
import {useCollapsingTitle} from '#/features/news/hub/useCollapsingTitle'
import {useInterestAccounts} from '../state/interestAccounts'
import {NewsFeedRailColumn} from './NewsFeedRailColumn'

export function NewsFeedTab() {
  const {t: l} = useLingui()
  const {gtPhone} = useBreakpoints()
  /*
   * The interest picked in the right column narrows the feed to it; none
   * shows every interest at once. Kept on the page only.
   */
  const [interestId, setInterestId] = useState<string | undefined>()
  const {hasInterests, dids, isLoading, isError, refetch} =
    useInterestAccounts(interestId)

  const {wide} = useExploreSpread()
  /** Height of the pinned header, which the right column sits under. */
  const [chromeHeight, setChromeHeight] = useState(0)
  const titleCollapse = useCollapsingTitle()
  const parentScrollHandlers = useScrollHandlers()

  /*
   * The header and the hub's tabs pin above the feed on every screen size. On
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
          <View onLayout={titleCollapse.onTitleLayout}>
            <NewsHubHeader active="feed">
              {/* The same settings as the News tab's. Just the icon on a
               * phone, where it shares a row with the tabs. */}
              <Link
                testID="newsFeedSettingsBtn"
                to="/news/settings"
                label={l`Choose your news interests`}
                size="small"
                color="secondary"
                shape={gtPhone ? 'default' : 'round'}>
                <ButtonIcon icon={SettingsGear} />
                {gtPhone && (
                  <ButtonText>
                    <Trans>Preferences</Trans>
                  </ButtonText>
                )}
              </Link>
            </NewsHubHeader>
          </View>
        </Animated.View>
      </View>
      {/* Relative, so the right column can run the feed's full height and
       * stick within it. */}
      <View style={[a.relative, a.flex_1]}>
        {isLoading ? (
          <Layout.Center style={[a.flex_1, a.align_center, a.p_2xl]}>
            <Loader size="xl" />
          </Layout.Center>
        ) : isError ? (
          <Notice
            message={l`Couldn’t load the outlets of your interests.`}
            action={
              <Button
                label={l`Try again`}
                size="small"
                color="secondary"
                onPress={() => void refetch()}>
                <ButtonText>
                  <Trans>Try again</Trans>
                </ButtonText>
              </Button>
            }
          />
        ) : !hasInterests ? (
          <Notice
            message={l`Choose the news you follow, and the latest posts from its outlets show here.`}
            action={<SettingsLink text={l`Choose your interests`} />}
          />
        ) : !dids || dids.length === 0 ? (
          <Notice
            message={l`None of the outlets in your interests post on the network yet.`}
            action={<SettingsLink text={l`Adjust your interests`} />}
          />
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
              feed={`newsfeed|${dids.join(',')}`}
              renderEmptyState={renderEmpty}
            />
          </ScrollProvider>
        )}
        {wide && (
          <NewsFeedRailColumn
            top={chromeHeight}
            offset={titleCollapse.offset}
            selectedInterestId={interestId}
            onSelectInterest={setInterestId}
          />
        )}
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

function Notice({message, action}: {message: string; action: React.ReactNode}) {
  const t = useTheme()
  return (
    <Layout.Center style={[a.flex_1, a.align_center, a.p_2xl, a.gap_lg]}>
      <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
        {message}
      </Text>
      {action}
    </Layout.Center>
  )
}

function SettingsLink({text}: {text: string}) {
  return (
    <Link to="/news/settings" label={text} size="small" color="secondary">
      <ButtonText>{text}</ButtonText>
    </Link>
  )
}
