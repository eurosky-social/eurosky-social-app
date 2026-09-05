import {View} from 'react-native'
import Animated, {FadeInDown, FadeOut} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, platform, useTheme} from '#/alf'
import {
  type AutocompleteEmoji,
  type AutocompleteItemType,
  type AutocompleteProfile,
  useAutocomplete,
} from '#/components/Autocomplete'
import {ProfileBadges} from '#/components/ProfileBadges'
import {Text} from '#/components/Typography'

export type ActiveAutocomplete = {
  type: Extract<AutocompleteItemType, 'profile' | 'emoji'>
  query: string
}

export function Autocomplete({
  active,
  onSelect,
}: {
  active: ActiveAutocomplete | null
  onSelect: (item: AutocompleteProfile | AutocompleteEmoji) => void
}) {
  const t = useTheme()
  const {items, isFetching} = useAutocomplete({
    type: active?.type ?? 'profile',
    query: active?.query ?? '',
    limit: 5,
    enabled: !!active?.query,
  })

  if (!active?.query) return null

  const suggestions = items.filter(item => item.type === active.type)

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(100)}
      style={[
        t.atoms.bg,
        a.mt_sm,
        a.border,
        a.rounded_sm,
        t.atoms.border_contrast_high,
        {marginLeft: -62},
      ]}>
      {suggestions.length ? (
        suggestions.slice(0, 5).map((item, index, arr) => {
          if (item.type === 'profile') {
            return (
              <AutocompleteProfileCard
                key={item.key}
                profile={item.profile}
                itemIndex={index}
                totalItems={arr.length}
                onPress={() => onSelect(item)}
              />
            )
          }

          if (item.type === 'emoji') {
            return (
              <AutocompleteEmojiCard
                key={item.key}
                item={item}
                itemIndex={index}
                totalItems={arr.length}
                onPress={() => onSelect(item)}
              />
            )
          }

          return null
        })
      ) : (
        <Text style={[a.text_md, a.px_sm, a.py_md]}>
          {isFetching ? <Trans>Loading...</Trans> : <Trans>No result</Trans>}
        </Text>
      )}
    </Animated.View>
  )
}

function AutocompleteProfileCard({
  profile,
  itemIndex,
  totalItems,
  onPress,
}: {
  profile: AutocompleteProfile['profile']
  itemIndex: number
  totalItems: number
  onPress: () => void
}) {
  const t = useTheme()
  const displayName = sanitizeDisplayName(
    profile.displayName || sanitizeHandle(profile.handle),
  )

  return (
    <View
      style={[
        itemIndex !== totalItems - 1 && a.border_b,
        t.atoms.border_contrast_high,
        a.px_sm,
        a.py_md,
      ]}>
      <PressableScale
        testID="autocompleteButton"
        style={[a.flex_row, a.gap_lg, a.justify_between, a.align_center]}
        onPress={onPress}
        accessibilityLabel={`Select ${profile.handle}`}
        accessibilityHint="">
        <View style={[a.flex_row, a.gap_sm, a.align_center, a.flex_1]}>
          <UserAvatar
            avatar={profile.avatar ?? null}
            size={24}
            type={profile.associated?.labeler ? 'labeler' : 'user'}
          />
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_xs,
              platform({ios: a.flex_1}),
            ]}>
            <Text
              style={[a.text_md, a.font_semi_bold, a.leading_snug]}
              emoji
              numberOfLines={1}>
              {displayName}
            </Text>
            <ProfileBadges
              profile={profile}
              size="sm"
              style={[
                {
                  marginTop: platform({android: -2}),
                },
              ]}
            />
          </View>
        </View>
        <Text
          style={[t.atoms.text_contrast_medium, a.text_right, a.leading_snug]}
          numberOfLines={1}>
          {sanitizeHandle(profile.handle, '@')}
        </Text>
      </PressableScale>
    </View>
  )
}

function AutocompleteEmojiCard({
  item,
  itemIndex,
  totalItems,
  onPress,
}: {
  item: AutocompleteEmoji
  itemIndex: number
  totalItems: number
  onPress: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()

  return (
    <View
      style={[
        itemIndex !== totalItems - 1 && a.border_b,
        t.atoms.border_contrast_high,
      ]}>
      <PressableScale
        testID="emojiAutocompleteButton"
        style={[a.flex_row, a.align_center, a.gap_sm, a.px_md, a.py_sm]}
        onPress={onPress}
        accessibilityLabel={l`Insert ${item.emoji.name} emoji`}
        accessibilityHint="">
        <Text emoji style={[a.text_xl, a.leading_tight]}>
          {item.value}
        </Text>
        <View style={[a.flex_1]}>
          <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            :{item.emoji.id}:
          </Text>
          <Text
            style={[t.atoms.text_contrast_medium, a.text_sm, a.leading_snug]}
            numberOfLines={1}>
            {item.emoji.name}
          </Text>
        </View>
      </PressableScale>
    </View>
  )
}
