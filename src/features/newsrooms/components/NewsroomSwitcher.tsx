import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useProfilesQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Earth_Stroke2_Corner2_Rounded as ExploreIcon} from '#/components/icons/Globe'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {readableAccent} from '../accent'
import {getPublisherName, type NewsroomPublisher} from '../publishers'

/**
 * The top of the newsroom hub: a horizontal rail of the registered publishers,
 * led by the cross-newsroom explore page. Selecting a publisher focuses that org
 * and re-themes the page in its accent. This is the hub's primary navigation, so
 * it reads as switching between branded spaces rather than filtering a list.
 */
export function NewsroomSwitcher({
  publishers,
  selectedId,
  onSelect,
  exploreActive = false,
  onSelectExplore,
}: {
  publishers: NewsroomPublisher[]
  /** The focused publisher, or none while explore is active. */
  selectedId?: string
  onSelect: (publisher: NewsroomPublisher) => void
  exploreActive?: boolean
  /** Omit to hide the explore tab, e.g. where explore cannot be reached. */
  onSelectExplore?: () => void
}) {
  const t = useTheme()
  // Live org profiles: avatar and display name both come from the network.
  const {data} = useProfilesQuery({handles: publishers.map(p => p.did)})
  const profileByDid = new Map<string, app.bsky.actor.defs.ProfileViewDetailed>(
    data?.profiles.map(profile => [profile.did, profile]) ?? [],
  )

  return (
    <View
      style={[a.border_b, t.atoms.border_contrast_low, t.atoms.bg]}
      testID="newsroomSwitcher">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[a.flex_row, a.align_center, a.gap_sm, a.p_md]}>
        {!!onSelectExplore && (
          <>
            <ExploreTab active={exploreActive} onPress={onSelectExplore} />
            {/* Explore is a different kind of destination from a branded org
             * space, so it sits apart from the publisher tabs. */}
            <View
              style={[
                t.atoms.border_contrast_low,
                a.border_l,
                a.self_stretch,
                a.mx_2xs,
              ]}
            />
          </>
        )}
        {publishers.map(publisher => (
          <OrgTab
            key={publisher.id}
            publisher={publisher}
            profile={profileByDid.get(publisher.did)}
            active={publisher.id === selectedId}
            onPress={() => onSelect(publisher)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

/**
 * The rail's first tab: every newsroom at once. Tinted in the app accent rather
 * than a publisher's, since it belongs to no single org.
 */
function ExploreTab({active, onPress}: {active: boolean; onPress: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <Button
      testID="newsroomExploreTab"
      label={l`Explore the newsrooms`}
      onPress={onPress}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.rounded_full,
        a.px_md,
        a.py_sm,
        a.border,
        active
          ? {
              borderColor: t.palette.primary_500,
              backgroundColor: t.palette.primary_25,
            }
          : [t.atoms.border_contrast_low, t.atoms.bg_contrast_25],
      ]}>
      {/* Sized to the publisher tabs' avatar so both tabs stand the same
       * height in the rail. */}
      <View style={[a.align_center, a.justify_center, {width: 24, height: 24}]}>
        <ExploreIcon
          size="md"
          style={
            active
              ? {color: t.palette.primary_500}
              : t.atoms.text_contrast_medium
          }
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          a.text_sm,
          a.font_bold,
          active
            ? {color: t.palette.primary_500}
            : t.atoms.text_contrast_medium,
        ]}>
        <Trans>Explore</Trans>
      </Text>
    </Button>
  )
}

function OrgTab({
  publisher,
  profile,
  active,
  onPress,
}: {
  publisher: NewsroomPublisher
  profile?: app.bsky.actor.defs.ProfileViewDetailed
  active: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accent = readableAccent(publisher.accent, t)
  const name = getPublisherName(profile)

  return (
    <Button
      label={l`Focus ${name}`}
      onPress={onPress}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.rounded_full,
        a.px_md,
        a.py_sm,
        a.border,
        active
          ? {borderColor: accent, backgroundColor: accent + '1A'}
          : [t.atoms.border_contrast_low, t.atoms.bg_contrast_25],
      ]}>
      <UserAvatar type="user" size={24} avatar={profile?.avatar} />
      <Text
        emoji
        numberOfLines={1}
        style={[
          a.text_sm,
          a.font_bold,
          active ? {color: accent} : t.atoms.text_contrast_medium,
        ]}>
        {name}
      </Text>
    </Button>
  )
}
