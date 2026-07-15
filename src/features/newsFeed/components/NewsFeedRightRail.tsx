import {View} from 'react-native'
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
  NEWSROOM_PUBLISHERS,
  type NewsroomPublisher,
} from '#/features/newsrooms/publishers'

const FEATURED_SHOWN = 4

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
  const publishers = NEWSROOM_PUBLISHERS.slice(0, FEATURED_SHOWN)
  // Real org avatars, same as the newsroom's own org switcher.
  const {data} = useProfilesQuery({handles: publishers.map(p => p.did)})
  const avatarByDid = new Map(
    data?.profiles.map(profile => [profile.did, profile.avatar]) ?? [],
  )

  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={NewsroomsIcon} />
        <ModuleHeader.TitleText>{l`Mu Newsrooms`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Explore the newsrooms of our featured publishers</Trans>
        </Text>
        <View style={[a.gap_md]}>
          {publishers.map(publisher => (
            <FeaturedNewsroom
              key={publisher.id}
              publisher={publisher}
              avatar={avatarByDid.get(publisher.did)}
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
  avatar,
}: {
  publisher: NewsroomPublisher
  avatar?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <Link
      to={`/newsroom/${publisher.did}`}
      label={l`Open the ${publisher.displayName} newsroom`}
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <UserAvatar type="user" size={32} avatar={avatar} />
      <View style={[a.flex_1]}>
        <Text emoji numberOfLines={1} style={[a.text_sm, a.font_bold]}>
          {publisher.displayName}
        </Text>
        <Text
          numberOfLines={1}
          style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {publisher.tagline}
        </Text>
      </View>
    </Link>
  )
}
