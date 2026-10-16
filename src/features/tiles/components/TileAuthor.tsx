import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {ProfileHoverCard} from '#/components/ProfileHoverCard'
import {Text} from '#/components/Typography'
import {VerificationCheck} from '#/components/verification/VerificationCheck'
import {type TileAuthor} from '../author'

/**
 * The card footer's author line: a tiny avatar, the name, the check when the
 * author is one of our verified accounts (which is what lets the tile run),
 * and the handle. Plain text, not links: the whole card is the play button.
 */
export function TileAuthorLine({
  author,
  hovered = false,
}: {
  author: TileAuthor
  hovered?: boolean
}) {
  const t = useTheme()
  const profile = useProfileShadow(author.profile)
  const moderationOpts = useModerationOpts()
  const moderation = moderationOpts
    ? moderateProfile(profile, moderationOpts)
    : undefined
  const name = sanitizeDisplayName(
    profile.displayName || profile.handle,
    moderation?.ui('displayName'),
  )

  return (
    <ProfileHoverCard did={profile.did}>
      <View style={[a.flex_1, a.flex_row, a.align_center, a.gap_xs]}>
        <UserAvatar
          type="user"
          size={16}
          avatar={profile.avatar}
          moderation={moderation?.ui('avatar')}
        />
        <Text
          emoji
          numberOfLines={1}
          style={[
            a.flex_shrink,
            a.transition_color,
            a.text_xs,
            a.font_semi_bold,
            a.leading_snug,
            hovered ? t.atoms.text : t.atoms.text_contrast_high,
          ]}>
          {name}
        </Text>
        {author.trusted && (
          <VerificationCheck
            width={12}
            fill={t.palette.primary_500}
            verifier={false}
          />
        )}
        <Text
          emoji
          numberOfLines={1}
          style={[
            a.flex_shrink,
            a.transition_color,
            a.text_xs,
            a.leading_snug,
            hovered ? t.atoms.text_contrast_high : t.atoms.text_contrast_medium,
            {flexShrink: 10},
          ]}>
          {sanitizeHandle(profile.handle, '@')}
        </Text>
      </View>
    </ProfileHoverCard>
  )
}
