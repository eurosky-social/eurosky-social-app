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
import {atoms as a, native, useTheme, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {useThemeName} from '#/features/news/dutch/queries'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/news/explore/components/ExploreColumn'
import {OutletIcon} from '#/features/news/explore/components/OutletIcon'
import {
  BandRule,
  ColumnRule,
  KickerText,
} from '#/features/news/explore/components/Rules'
import {countryName} from '#/features/news/explore/useInterestTitle'
import {useCollapsingTitle} from '#/features/news/hub/useCollapsingTitle'
import {getPublisherName} from '#/features/news/publishers'
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {useNewsFeedPrefsQuery} from '#/features/newsFeed/state/prefs'
import {type app} from '#/lexicons'
import {
  type Frontpage,
  frontpagePath,
  storyCount,
  topThemes,
  useFrontpageProfiles,
  useFrontpages,
} from '../frontpages'

/** Above this spread width the list runs three across, not two. */
const THREE_COLUMN_WIDTH = 1100

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OutletDirectory'>

/** How many frontpages the section for the reader's interests lists. */
const INTERESTS_SHOWN = 12

/**
 * Every frontpage - every one of the news aggregator's outlets - as a page of
 * its own: first those of the reader's interests, then all of them by
 * country. This is where frontpages are found rather than a rail on every hub
 * screen.
 *
 * Drawn like the explore spread - rows divided by rules rather than a grid of
 * boxes - so the hub's pages read as one publication.
 */
export function OutletDirectoryScreen(_props: Props) {
  const {t: l, i18n} = useLingui()
  const {wide, width} = useExploreSpread()
  const {frontpages, isLoading} = useFrontpages()
  const {data: prefs} = useNewsFeedPrefsQuery()
  const profiles = useFrontpageProfiles(frontpages)
  const titleCollapse = useCollapsingTitle()
  const titleScrollHandler = useAnimatedScrollHandler(event => {
    titleCollapse.onScroll(event)
  })
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))

  const columns = !wide ? 1 : width >= THREE_COLUMN_WIDTH ? 3 : 2
  const sections: {key: string; title: string; frontpages: Frontpage[]}[] = []
  const yours = interestFrontpages(prefs?.interests ?? [], frontpages ?? [])
  if (yours.length > 0) {
    sections.push({
      key: 'interests',
      title: l`From your interests`,
      frontpages: yours,
    })
  }
  const byCountry = new Map<string, Frontpage[]>()
  for (const frontpage of frontpages ?? []) {
    const country = frontpage.country ?? ''
    byCountry.set(country, [...(byCountry.get(country) ?? []), frontpage])
  }
  sections.push(
    ...[...byCountry.entries()]
      .map(([country, group]) => ({
        key: country,
        title: country ? countryName(country, i18n.locale) : l`Elsewhere`,
        frontpages: group.sort((x, y) =>
          x.name.localeCompare(y.name, i18n.locale),
        ),
      }))
      /* Countries by name; outlets with none last. */
      .sort((x, y) =>
        !x.key ? 1 : !y.key ? -1 : x.title.localeCompare(y.title, i18n.locale),
      ),
  )

  return (
    <Layout.Screen testID="outletDirectoryScreen" noCenterBorders>
      <ExploreSpreadBorders />
      {/* The header pins outside the scroll view: on web the window scrolls,
       * which a sticky header inside it cannot follow. */}
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
          ) : sections.length === 0 ? (
            <View style={[a.p_2xl, a.align_center]}>
              <Text style={[a.text_md, a.text_center]}>
                <Trans>No outlets are available right now.</Trans>
              </Text>
            </View>
          ) : (
            sections.map(section => (
              <Fragment key={section.key}>
                <View style={[a.px_lg, a.pt_2xl, a.pb_sm]}>
                  <KickerText>{section.title}</KickerText>
                </View>
                <BandRule />
                {rowsOf(section.frontpages, columns).map(row => (
                  <Fragment
                    key={row.map(frontpage => frontpage.slug).join(',')}>
                    <View style={[a.flex_row, a.align_stretch]}>
                      {row.map((frontpage, index) => (
                        <Fragment key={frontpage.slug}>
                          {index > 0 && <ColumnRule />}
                          <OutletRow
                            frontpage={frontpage}
                            profile={
                              frontpage.did
                                ? profiles.get(frontpage.did)
                                : undefined
                            }
                          />
                        </Fragment>
                      ))}
                      {/* Keeps a short last row in its columns instead of
                       * letting its entries stretch across the width. */}
                      {Array.from(
                        {length: columns - row.length},
                        (_, index) => (
                          <View key={`empty-${index}`} style={[a.flex_1]} />
                        ),
                      )}
                    </View>
                    <BandRule />
                  </Fragment>
                ))}
              </Fragment>
            ))
          )}
        </ExploreColumn>
      </Animated.ScrollView>
    </Layout.Screen>
  )
}

/** The frontpages in rows of `columns`. */
function rowsOf(frontpages: Frontpage[], columns: number): Frontpage[][] {
  const rows: Frontpage[][] = []
  for (let i = 0; i < frontpages.length; i += columns) {
    rows.push(frontpages.slice(i, i + columns))
  }
  return rows
}

/**
 * The frontpages of the reader's interests: those of an interest's places, or
 * of anywhere for one with none, less the outlets it leaves out - the ones
 * that cover its topics most first, since that is what the reader follows
 * them for.
 */
function interestFrontpages(
  interests: NewsInterest[],
  frontpages: Frontpage[],
): Frontpage[] {
  const scores = new Map<string, number>()
  for (const interest of interests) {
    for (const frontpage of frontpages) {
      if (interest.excludedOutlets.includes(frontpage.slug)) continue
      if (
        interest.countries.length > 0 &&
        !(frontpage.country && interest.countries.includes(frontpage.country))
      ) {
        continue
      }
      const stories =
        interest.themes.length > 0
          ? interest.themes.reduce(
              (sum, theme) => sum + (frontpage.themes[theme] ?? 0),
              0,
            )
          : storyCount(frontpage)
      if (stories === 0) continue
      scores.set(frontpage.slug, (scores.get(frontpage.slug) ?? 0) + stories)
    }
  }
  return frontpages
    .filter(frontpage => scores.has(frontpage.slug))
    .sort((x, y) => scores.get(y.slug)! - scores.get(x.slug)!)
    .slice(0, INTERESTS_SHOWN)
}

/**
 * One frontpage: its live profile where it has an account, else its site. The
 * whole row links to its frontpage rather than to a Bluesky profile.
 */
function OutletRow({
  frontpage,
  profile,
}: {
  frontpage: Frontpage
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const themeName = useThemeName()
  const name = getPublisherName(profile) || frontpage.name
  const stories = storyCount(frontpage)
  const detail = [
    profile?.handle ? `@${profile.handle}` : frontpage.domains[0],
    stories > 0
      ? plural(stories, {one: '# current story', other: '# current stories'})
      : undefined,
  ]
    .filter(Boolean)
    .join('\u00a0– ')
  const themes = topThemes(frontpage, 3)

  return (
    <Link
      testID={`outletRow-${frontpage.slug}`}
      to={frontpagePath(frontpage)}
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
          <OutletIcon
            outlet={{
              id: frontpage.slug,
              did: frontpage.did,
              name: frontpage.name,
              site: frontpage.domains[0],
              categories: [],
            }}
            profile={profile}
            size={44}
          />
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
            {!!detail && (
              <Text
                numberOfLines={1}
                style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {detail}
              </Text>
            )}
            {!!profile?.description && (
              <Text
                emoji
                numberOfLines={2}
                style={[a.text_sm, a.leading_snug, a.pt_xs, t.atoms.text]}>
                {profile.description}
              </Text>
            )}
            {themes.length > 0 && (
              <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.pt_sm]}>
                {themes.map(theme => (
                  <View
                    key={theme}
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
                      {themeName(theme)}
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
