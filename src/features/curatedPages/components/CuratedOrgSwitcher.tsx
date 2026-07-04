import {ScrollView, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useProfilesQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Text} from '#/components/Typography'
import {type CuratedPublisher} from '../publishers'

/**
 * The top of the curated hub: a horizontal rail of the registered publishers.
 * Selecting a tab focuses that org and re-themes the page in its accent. This is
 * the page's primary navigation, so it reads as switching between branded spaces
 * rather than filtering a list.
 */
export function CuratedOrgSwitcher({
  publishers,
  selectedId,
  onSelect,
}: {
  publishers: CuratedPublisher[]
  selectedId: string
  onSelect: (publisher: CuratedPublisher) => void
}) {
  const t = useTheme()
  // Real org avatars keep the rail recognizable at a glance.
  const {data} = useProfilesQuery({handles: publishers.map(p => p.did)})
  const avatarByDid = new Map(
    data?.profiles.map(profile => [profile.did, profile.avatar]) ?? [],
  )

  return (
    <View
      style={[a.border_b, t.atoms.border_contrast_low, t.atoms.bg]}
      testID="curatedOrgSwitcher">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[a.flex_row, a.align_center, a.gap_sm, a.p_md]}>
        {publishers.map(publisher => (
          <OrgTab
            key={publisher.id}
            publisher={publisher}
            avatar={avatarByDid.get(publisher.did)}
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
  avatar,
  active,
  onPress,
}: {
  publisher: CuratedPublisher
  avatar?: string
  active: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const accent = publisher.accent ?? t.palette.primary_500

  return (
    <Button
      label={l`Focus ${publisher.displayName}`}
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
      <UserAvatar type="user" size={24} avatar={avatar} />
      <Text
        emoji
        numberOfLines={1}
        style={[
          a.text_sm,
          a.font_bold,
          active ? {color: accent} : t.atoms.text_contrast_medium,
        ]}>
        {publisher.displayName}
      </Text>
    </Button>
  )
}
