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
import {useSession} from '#/state/session'
import {useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a, native, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {ButtonIcon} from '#/components/Button'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/news/explore/components/ExploreColumn'
import {NewsHubTabs} from '#/features/news/hub/NewsHubTabs'
import {useCollapsingTitle} from '#/features/news/hub/useCollapsingTitle'
import {Rows, SupplementCard} from './components'
import {SUPPLEMENT_EDITOR_DIDS} from './config'
import {type StoredSupplement} from './records'
import {useSupplementsQueries} from './state'
import {groupSupplements, localDay} from './supplement'

/**
 * The hub's supplements tab: the configured editors' and the reader's own, the
 * current ones first and the archive below them.
 */
export function SupplementsScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'Supplements'>,
) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {wide} = useExploreSpread()
  const {gtMobile} = useBreakpoints()
  const titleCollapse = useCollapsingTitle()
  const titleScrollHandler = useAnimatedScrollHandler(event => {
    titleCollapse.onScroll(event)
  })
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))
  const dids = [
    ...new Set([
      ...SUPPLEMENT_EDITOR_DIDS,
      ...(currentAccount ? [currentAccount.did] : []),
    ]),
  ]
  const {supplements, isLoading, isError, refetch} = useSupplementsQueries(dids)
  const {upcoming, current, archived} = groupSupplements(
    supplements,
    localDay(),
    currentAccount?.did,
  )
  const columns = wide ? 3 : gtMobile ? 2 : 1
  const empty = !upcoming.length && !current.length && !archived.length

  return (
    <Layout.Screen testID="supplementsScreen" noCenterBorders>
      <ExploreSpreadBorders />
      <View
        pointerEvents="box-none"
        style={[web([a.sticky, {top: 0}]), native(a.overflow_hidden), a.z_10]}>
        <Animated.View style={titleCollapse.blockStyle}>
          <View onLayout={titleCollapse.onTitleLayout}>
            <ExploreHeaderOuter>
              <Layout.Header.BackButton />
              <Layout.Header.Content>
                <Layout.Header.TitleText>
                  <Trans>{BRAND.name} News</Trans>
                </Layout.Header.TitleText>
              </Layout.Header.Content>
            </ExploreHeaderOuter>
            <ExploreColumn
              style={[a.border_b, t.atoms.bg, t.atoms.border_contrast_low]}>
              <NewsHubTabs active="supplements" />
            </ExploreColumn>
          </View>
        </Animated.View>
      </View>

      <Animated.ScrollView
        style={scrollStyle}
        onScroll={titleScrollHandler}
        scrollEventThrottle={16}>
        <ExploreColumn>
          <View style={[a.px_lg, a.py_lg, a.gap_2xl]}>
            {currentAccount && (
              <Link
                testID="supplementNew"
                to="/news/supplements/new"
                label={l`New supplement`}
                size="small"
                color="primary"
                style={[a.self_start]}>
                <ButtonIcon icon={PlusIcon} />
                <ButtonText>
                  <Trans>New supplement</Trans>
                </ButtonText>
              </Link>
            )}
            {isLoading ? (
              <View style={[a.p_2xl, a.align_center]}>
                <Loader size="lg" />
              </View>
            ) : isError ? (
              <View style={[a.p_2xl, a.align_center, a.gap_md]}>
                <Text style={[a.text_md, a.text_center]}>
                  <Trans>Couldn’t load the supplements.</Trans>
                </Text>
                <Button
                  label={l`Try again`}
                  size="small"
                  color="secondary"
                  onPress={() => void refetch()}>
                  <ButtonText>
                    <Trans>Try again</Trans>
                  </ButtonText>
                </Button>
              </View>
            ) : empty ? (
              <View style={[a.p_2xl, a.align_center]}>
                <Text style={[a.text_md, a.text_center]}>
                  <Trans>No supplements right now.</Trans>
                </Text>
              </View>
            ) : (
              <>
                <Group
                  title={l({
                    message: 'Upcoming',
                    context: 'Supplements before their start date',
                  })}
                  supplements={upcoming}
                  columns={columns}
                />
                <Group
                  title={l({
                    message: 'Current',
                    context: 'Supplements between their dates',
                  })}
                  supplements={current}
                  columns={columns}
                />
                <Group
                  title={l({
                    message: 'Archive',
                    context: 'Supplements past their end date',
                  })}
                  supplements={archived}
                  columns={columns}
                />
              </>
            )}
          </View>
        </ExploreColumn>
      </Animated.ScrollView>
    </Layout.Screen>
  )
}

function Group({
  title,
  supplements,
  columns,
}: {
  title: string
  supplements: StoredSupplement[]
  columns: number
}) {
  if (!supplements.length) return null
  return (
    <View style={[a.gap_md]}>
      <Text accessibilityRole="header" style={[a.text_xl, a.font_bold]}>
        {title}
      </Text>
      <Rows
        items={supplements}
        columns={columns}
        keyOf={({did, rkey}) => `${did}/${rkey}`}>
        {stored => <SupplementCard stored={stored} />}
      </Rows>
    </View>
  )
}
