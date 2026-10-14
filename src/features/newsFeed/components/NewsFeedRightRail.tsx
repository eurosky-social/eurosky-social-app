import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme} from '#/alf'
import {ButtonText} from '#/components/Button'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomsIcon} from '#/components/icons/Newspaper2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {ExploreLiveSportsWidget} from '#/features/liveSports/components/ExploreLiveSportsWidget'
import {OutletIcon} from '#/features/newsrooms/explore/components/OutletIcon'
import {
  type Newsroom,
  newsroomPath,
  storyCount,
  useNewsroomProfiles,
  useNewsrooms,
} from '#/features/newsrooms/newsrooms'
import {getPublisherName} from '#/features/newsrooms/publishers'
import {type app} from '#/lexicons'
import {selectSources} from '../sources'
import {useNewsFeedPrefsQuery} from '../state/prefs'

/**
 * The news feed's right column: the mirror of the newsroom rail's "Your News"
 * module, pointing the other way - into the publisher hubs - plus the same
 * cross-network live sports context.
 */
export function NewsFeedRightRail() {
  return (
    <View>
      <NewsroomsModule />
      <ExploreLiveSportsWidget />
    </View>
  )
}

/** How many newsrooms the module features when the feed names none. */
const FEATURED_COUNT = 8

function NewsroomsModule() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: prefs} = useNewsFeedPrefsQuery()
  const {newsrooms} = useNewsrooms()

  // With a configured feed, feature the newsrooms already among its sources;
  // without one (or when none of its sources have a newsroom), feature the
  // newsrooms with the most current stories.
  const sourceDids =
    prefs && prefs.topics.length > 0
      ? new Set(
          selectSources({
            topics: prefs.topics,
            regions: prefs.regions,
            excludedDids: prefs.excludedDids,
          }).map(source => source.did),
        )
      : null
  const fromFeed =
    sourceDids && newsrooms
      ? newsrooms.filter(
          newsroom => newsroom.did && sourceDids.has(newsroom.did),
        )
      : []
  const featured =
    fromFeed.length > 0
      ? fromFeed
      : [...(newsrooms ?? [])]
          .sort((x, y) => storyCount(y) - storyCount(x))
          .slice(0, FEATURED_COUNT)
  const profiles = useNewsroomProfiles(featured)

  /* Newsrooms are the news aggregator's outlets; without it there are none. */
  if (featured.length === 0) return null

  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={NewsroomsIcon} />
        <ModuleHeader.TitleText>{l`Your Newsrooms`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {fromFeed.length > 0 ? (
            <Trans>Newsrooms from the sources in your news feed</Trans>
          ) : (
            <Trans>The newsrooms with the most stories right now</Trans>
          )}
        </Text>
        <View style={[a.gap_md]}>
          {featured.map(newsroom => (
            <FeaturedNewsroom
              key={newsroom.slug}
              newsroom={newsroom}
              profile={newsroom.did ? profiles.get(newsroom.did) : undefined}
            />
          ))}
        </View>
        <Link
          to="/newsrooms"
          label={l`See all newsrooms`}
          color="primary"
          size="large"
          style={[a.w_full, a.justify_center]}>
          <ButtonText>
            <Trans>See all newsrooms</Trans>
          </ButtonText>
        </Link>
      </View>
    </View>
  )
}

function FeaturedNewsroom({
  newsroom,
  profile,
}: {
  newsroom: Newsroom
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const {t: l} = useLingui()
  const name = getPublisherName(profile) || newsroom.name

  return (
    <Link
      to={newsroomPath(newsroom)}
      label={l`Open the ${name} newsroom`}
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <OutletIcon
        outlet={{
          id: newsroom.slug,
          did: newsroom.did,
          name: newsroom.name,
          site: newsroom.domains[0],
          categories: [],
        }}
        profile={profile}
        size={28}
      />
      <Text emoji numberOfLines={1} style={[a.flex_1, a.text_sm, a.font_bold]}>
        {name}
      </Text>
    </Link>
  )
}
