import {View} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'
import {Trans, useLingui} from '@lingui/react/macro'

import {useProfilesQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme} from '#/alf'
import {ButtonText} from '#/components/Button'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomsIcon} from '#/components/icons/Newspaper2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {ExploreLiveSportsWidget} from '#/features/liveSports/components/ExploreLiveSportsWidget'
import {
  getPublisherName,
  NEWSROOM_PUBLISHERS,
  type NewsroomPublisher,
} from '#/features/newsrooms/publishers'
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

function NewsroomsModule() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: prefs} = useNewsFeedPrefsQuery()

  // With a configured feed, feature the newsrooms already among its sources;
  // without one (or when none of its sources have a newsroom), fall back to
  // the full directory.
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
  const fromFeed = sourceDids
    ? NEWSROOM_PUBLISHERS.filter(p => sourceDids.has(p.did))
    : []
  const publishers = fromFeed.length > 0 ? fromFeed : NEWSROOM_PUBLISHERS

  // Live org profiles, same as the newsroom's own org switcher.
  const {data} = useProfilesQuery({
    handles: publishers.map(p => p.did),
  })
  const profileByDid = new Map(
    data?.profiles.map(profile => [profile.did, profile]) ?? [],
  )

  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={NewsroomsIcon} />
        <ModuleHeader.TitleText>{l`Mu Newsrooms`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {fromFeed.length > 0 ? (
            <Trans>Newsrooms from the sources in your news feed</Trans>
          ) : (
            <Trans>Explore the newsrooms of our featured publishers</Trans>
          )}
        </Text>
        <View style={[a.gap_md]}>
          {publishers.map(publisher => (
            <FeaturedNewsroom
              key={publisher.id}
              publisher={publisher}
              profile={profileByDid.get(publisher.did)}
            />
          ))}
        </View>
        <Link
          to="/newsroom"
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
  publisher,
  profile,
}: {
  publisher: NewsroomPublisher
  profile?: AppBskyActorDefs.ProfileViewDetailed
}) {
  const {t: l} = useLingui()
  const name = getPublisherName(profile)

  return (
    <Link
      to={`/newsroom/${publisher.did}`}
      label={l`Open the ${name} newsroom`}
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <UserAvatar type="user" size={28} avatar={profile?.avatar} />
      <Text emoji numberOfLines={1} style={[a.flex_1, a.text_sm, a.font_bold]}>
        {name}
      </Text>
    </Link>
  )
}
