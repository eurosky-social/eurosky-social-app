import {Fragment} from 'react'
import {View} from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useShellLayout} from '#/state/shell/shell-layout'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, native, useTheme, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from '../explore/components/ExploreColumn'
import {BandRule, ColumnRule} from '../explore/components/Rules'
import {NewsroomHubTabs} from '../hub/NewsroomHubTabs'
import {useCollapsingTitle} from '../hub/useCollapsingTitle'
import {
  getPublisherName,
  NEWSROOM_PUBLISHERS,
  type NewsroomPublisher,
} from '../publishers'
import {useNewsroomProfilesQuery} from '../queries'

/** Above this spread width the list runs three across, not two. */
const THREE_COLUMN_WIDTH = 1100

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsroomDirectory'>

/**
 * Every registered newsroom, as a page of its own. The registry will run to
 * hundreds of orgs, so this is where they are found rather than a rail on
 * every hub screen; search and filtering belong here when they come. The
 * order is the registry's for now.
 *
 * Drawn like the explore spread - rows divided by rules rather than a grid of
 * boxes - so the hub's pages read as one publication.
 */
export function NewsroomDirectoryScreen(_props: Props) {
  const t = useTheme()
  const {wide, width} = useExploreSpread()
  const profiles = useNewsroomProfilesQuery()
  const titleCollapse = useCollapsingTitle()
  const titleScrollHandler = useAnimatedScrollHandler(event => {
    titleCollapse.onScroll(event)
  })
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))

  const columns = !wide ? 1 : width >= THREE_COLUMN_WIDTH ? 3 : 2
  const rows: NewsroomPublisher[][] = []
  for (let i = 0; i < NEWSROOM_PUBLISHERS.length; i += columns) {
    rows.push(NEWSROOM_PUBLISHERS.slice(i, i + columns))
  }

  return (
    <Layout.Screen testID="newsroomDirectoryScreen" noCenterBorders>
      <ExploreSpreadBorders />
      {/* Header and tabs pin together, outside the scroll view: on web the
       * window scrolls, which a sticky header inside it cannot follow. */}
      <View
        pointerEvents="box-none"
        style={[web([a.sticky, {top: 0}]), native(a.overflow_hidden), a.z_10]}>
        <Animated.View style={titleCollapse.blockStyle}>
          <View onLayout={titleCollapse.onTitleLayout}>
            <ExploreHeaderOuter>
              <Layout.Header.BackButton />
              <Layout.Header.Content>
                <Layout.Header.TitleText>
                  <Trans>Mu News</Trans>
                </Layout.Header.TitleText>
              </Layout.Header.Content>
            </ExploreHeaderOuter>
          </View>
          <ExploreColumn style={[t.atoms.bg]}>
            <NewsroomHubTabs active="newsrooms" />
          </ExploreColumn>
        </Animated.View>
      </View>

      <Animated.ScrollView
        style={scrollStyle}
        onScroll={titleScrollHandler}
        scrollEventThrottle={16}>
        <ExploreColumn>
          {rows.map(row => (
            <Fragment key={row.map(publisher => publisher.id).join(',')}>
              <View style={[a.flex_row, a.align_stretch]}>
                {row.map((publisher, index) => (
                  <Fragment key={publisher.id}>
                    {index > 0 && <ColumnRule />}
                    <NewsroomRow
                      publisher={publisher}
                      profile={profiles.get(publisher.did)}
                    />
                  </Fragment>
                ))}
                {/* Keeps a short last row in its columns instead of letting
                 * its entries stretch across the width. */}
                {Array.from({length: columns - row.length}, (_, index) => (
                  <View key={`empty-${index}`} style={[a.flex_1]} />
                ))}
              </View>
              <BandRule />
            </Fragment>
          ))}
        </ExploreColumn>
      </Animated.ScrollView>
    </Layout.Screen>
  )
}

/**
 * One newsroom from its live profile. The whole row links to the org's
 * newsroom page rather than to its Bluesky profile.
 */
function NewsroomRow({
  publisher,
  profile,
}: {
  publisher: NewsroomPublisher
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = getPublisherName(profile)
  const reporters = publisher.reporterDids.length

  return (
    <Link
      testID={`newsroomRow-${publisher.id}`}
      to={`/newsroom/${publisher.did}`}
      label={l`Open ${name}`}
      style={[
        a.flex_1,
        a.flex_row,
        a.align_start,
        a.gap_md,
        a.px_lg,
        a.py_lg,
        a.rounded_0,
        web({cursor: 'pointer'}),
      ]}>
      {({hovered, pressed}) => (
        <>
          <UserAvatar type="user" size={44} avatar={profile?.avatar} />
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
            <Text
              numberOfLines={1}
              style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {profile?.handle ? `@${profile.handle}` : ''}
              {profile?.handle && reporters > 0 ? '\u00a0– ' : ''}
              {reporters > 0
                ? plural(reporters, {one: '# reporter', other: '# reporters'})
                : ''}
            </Text>
            {!!profile?.description && (
              <Text
                emoji
                numberOfLines={2}
                style={[a.text_sm, a.leading_snug, a.pt_xs, t.atoms.text]}>
                {profile.description}
              </Text>
            )}
            {publisher.categories.length > 0 && (
              <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.pt_sm]}>
                {publisher.categories.map(category => (
                  <View
                    key={category}
                    style={[
                      a.rounded_full,
                      a.px_sm,
                      a.py_2xs,
                      a.border,
                      t.atoms.border_contrast_low,
                    ]}>
                    <Text
                      style={[
                        a.text_xs,
                        a.font_bold,
                        t.atoms.text_contrast_medium,
                      ]}>
                      {category}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </Link>
  )
}
