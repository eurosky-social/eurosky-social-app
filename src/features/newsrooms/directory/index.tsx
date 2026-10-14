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
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {useNewsFeedPrefsQuery} from '#/features/newsFeed/state/prefs'
import {type app} from '#/lexicons'
import {useThemeName} from '../dutch/queries'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from '../explore/components/ExploreColumn'
import {OutletIcon} from '../explore/components/OutletIcon'
import {BandRule, ColumnRule, KickerText} from '../explore/components/Rules'
import {countryName} from '../explore/useInterestTitle'
import {useCollapsingTitle} from '../hub/useCollapsingTitle'
import {
  type Newsroom,
  newsroomPath,
  storyCount,
  topThemes,
  useNewsroomProfiles,
  useNewsrooms,
} from '../newsrooms'
import {getPublisherName} from '../publishers'

/** Above this spread width the list runs three across, not two. */
const THREE_COLUMN_WIDTH = 1100

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsroomDirectory'>

/** How many newsrooms the section for the reader's interests lists. */
const INTERESTS_SHOWN = 12

/**
 * Every newsroom - every one of the news aggregator's outlets - as a page of
 * its own: first those of the reader's interests, then all of them by
 * country. This is where newsrooms are found rather than a rail on every hub
 * screen.
 *
 * Drawn like the explore spread - rows divided by rules rather than a grid of
 * boxes - so the hub's pages read as one publication.
 */
export function NewsroomDirectoryScreen(_props: Props) {
  const {t: l, i18n} = useLingui()
  const {wide, width} = useExploreSpread()
  const {newsrooms, isLoading} = useNewsrooms()
  const {data: prefs} = useNewsFeedPrefsQuery()
  const profiles = useNewsroomProfiles(newsrooms)
  const titleCollapse = useCollapsingTitle()
  const titleScrollHandler = useAnimatedScrollHandler(event => {
    titleCollapse.onScroll(event)
  })
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))

  const columns = !wide ? 1 : width >= THREE_COLUMN_WIDTH ? 3 : 2
  const sections: {key: string; title: string; newsrooms: Newsroom[]}[] = []
  const yours = interestNewsrooms(prefs?.interests ?? [], newsrooms ?? [])
  if (yours.length > 0) {
    sections.push({
      key: 'interests',
      title: l`From your interests`,
      newsrooms: yours,
    })
  }
  const byCountry = new Map<string, Newsroom[]>()
  for (const newsroom of newsrooms ?? []) {
    const country = newsroom.country ?? ''
    byCountry.set(country, [...(byCountry.get(country) ?? []), newsroom])
  }
  sections.push(
    ...[...byCountry.entries()]
      .map(([country, group]) => ({
        key: country,
        title: country ? countryName(country, i18n.locale) : l`Elsewhere`,
        newsrooms: group.sort((x, y) =>
          x.name.localeCompare(y.name, i18n.locale),
        ),
      }))
      /* Countries by name; outlets with none last. */
      .sort((x, y) =>
        !x.key ? 1 : !y.key ? -1 : x.title.localeCompare(y.title, i18n.locale),
      ),
  )

  return (
    <Layout.Screen testID="newsroomDirectoryScreen" noCenterBorders>
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
                <Trans>No newsrooms are available right now.</Trans>
              </Text>
            </View>
          ) : (
            sections.map(section => (
              <Fragment key={section.key}>
                <View style={[a.px_lg, a.pt_2xl, a.pb_sm]}>
                  <KickerText>{section.title}</KickerText>
                </View>
                <BandRule />
                {rowsOf(section.newsrooms, columns).map(row => (
                  <Fragment key={row.map(newsroom => newsroom.slug).join(',')}>
                    <View style={[a.flex_row, a.align_stretch]}>
                      {row.map((newsroom, index) => (
                        <Fragment key={newsroom.slug}>
                          {index > 0 && <ColumnRule />}
                          <NewsroomRow
                            newsroom={newsroom}
                            profile={
                              newsroom.did
                                ? profiles.get(newsroom.did)
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

/** The newsrooms in rows of `columns`. */
function rowsOf(newsrooms: Newsroom[], columns: number): Newsroom[][] {
  const rows: Newsroom[][] = []
  for (let i = 0; i < newsrooms.length; i += columns) {
    rows.push(newsrooms.slice(i, i + columns))
  }
  return rows
}

/**
 * The newsrooms of the reader's interests: those of an interest's places, or
 * of anywhere for one with none, less the outlets it leaves out - the ones
 * that cover its topics most first, since that is what the reader follows
 * them for.
 */
function interestNewsrooms(
  interests: NewsInterest[],
  newsrooms: Newsroom[],
): Newsroom[] {
  const scores = new Map<string, number>()
  for (const interest of interests) {
    for (const newsroom of newsrooms) {
      if (interest.excludedOutlets.includes(newsroom.slug)) continue
      if (
        interest.countries.length > 0 &&
        !(newsroom.country && interest.countries.includes(newsroom.country))
      ) {
        continue
      }
      const stories =
        interest.themes.length > 0
          ? interest.themes.reduce(
              (sum, theme) => sum + (newsroom.themes[theme] ?? 0),
              0,
            )
          : storyCount(newsroom)
      if (stories === 0) continue
      scores.set(newsroom.slug, (scores.get(newsroom.slug) ?? 0) + stories)
    }
  }
  return newsrooms
    .filter(newsroom => scores.has(newsroom.slug))
    .sort((x, y) => scores.get(y.slug)! - scores.get(x.slug)!)
    .slice(0, INTERESTS_SHOWN)
}

/**
 * One newsroom: its live profile where it has an account, else its site. The
 * whole row links to its newsroom page rather than to a Bluesky profile.
 */
function NewsroomRow({
  newsroom,
  profile,
}: {
  newsroom: Newsroom
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const themeName = useThemeName()
  const name = getPublisherName(profile) || newsroom.name
  const stories = storyCount(newsroom)
  const detail = [
    profile?.handle ? `@${profile.handle}` : newsroom.domains[0],
    stories > 0
      ? plural(stories, {one: '# current story', other: '# current stories'})
      : undefined,
  ]
    .filter(Boolean)
    .join('\u00a0– ')
  const themes = topThemes(newsroom, 3)

  return (
    <Link
      testID={`newsroomRow-${newsroom.slug}`}
      to={newsroomPath(newsroom)}
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
              id: newsroom.slug,
              did: newsroom.did,
              name: newsroom.name,
              site: newsroom.domains[0],
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
