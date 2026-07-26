import {ScrollView, View} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {useProfilesQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Text} from '#/components/Typography'
import {getPublisherName, type NewsroomPublisher} from '../publishers'

/**
 * The top of the newsroom hub: a horizontal rail of the registered publishers.
 * Selecting a tab focuses that org and re-themes the page in its accent. This is
 * the page's primary navigation, so it reads as switching between branded spaces
 * rather than filtering a list.
 */
export function NewsroomSwitcher({
  publishers,
  selectedId,
  onSelect,
}: {
  publishers: NewsroomPublisher[]
  selectedId: string
  onSelect: (publisher: NewsroomPublisher) => void
}) {
  const t = useTheme()
  // Live org profiles: avatar and display name both come from the network.
  const {data} = useProfilesQuery({handles: publishers.map(p => p.did)})
  const profileByDid = new Map(
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

function OrgTab({
  publisher,
  profile,
  active,
  onPress,
}: {
  publisher: NewsroomPublisher
  profile?: AppBskyActorDefs.ProfileViewDetailed
  active: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accent = publisher.accent ?? t.palette.primary_500
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
