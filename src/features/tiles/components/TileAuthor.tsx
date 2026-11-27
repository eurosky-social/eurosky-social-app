import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {PreviewableUserAvatar, UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {ProfileBadges} from '#/components/ProfileBadges'
import {ProfileHoverCard} from '#/components/ProfileHoverCard'
import {Text} from '#/components/Typography'
import {VerificationCheck} from '#/components/verification/VerificationCheck'
import {type TileAuthor} from '../author'

/**
 * The card footer's author line: a tiny avatar, the name, the check when the
 * author is one of our verified accounts (which is what lets the tile run),
 * and the handle. The line links to the author's profile; a press on it goes
 * there and does not reach the card around it, which is the play button.
 */
export function TileAuthorLine({
  author,
  hovered = false,
}: {
  author: TileAuthor
  hovered?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
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
      <Link
        to={makeProfileLink(profile)}
        label={l`View ${name}'s profile`}
        onPress={e => e.stopPropagation()}
        style={[a.flex_1, a.flex_row, a.align_center, a.gap_xs]}>
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
      </Link>
    </ProfileHoverCard>
  )
}

/**
 * The author of a tile where there is room to say who they are (its info
 * sheet, its own page), laid out the way a post names its author at the top
 * of a thread: the avatar, the name with the account's badges beside it,
 * and the handle under it. The card of a tile post has the one-line
 * `TileAuthorLine`. Avatar and name both lead to the author's profile.
 *
 * A name that moderation hides (an account that asks not to be shown to
 * signed-out visitors, say) is replaced by the bare handle, so that the
 * badge is never left hanging beside nothing.
 */
export function TileAuthorRow({
  author,
  onPress,
}: {
  author: TileAuthor
  /**
   * Runs as a link to the profile is followed: the sheet this row is in
   * closes itself. Inside a sheet the badges are not buttons, since they
   * would open a dialog over it.
   */
  onPress?: () => void
}) {
  const t = useTheme()
  const profile = useProfileShadow(author.profile)
  const moderationOpts = useModerationOpts()
  const moderation = moderationOpts
    ? moderateProfile(profile, moderationOpts)
    : undefined
  const handle = sanitizeHandle(profile.handle)
  const name =
    sanitizeDisplayName(
      profile.displayName || handle,
      moderation?.ui('displayName'),
    ) || handle

  return (
    <View style={[a.flex_1, a.flex_row, a.align_center, a.gap_md]}>
      <View collapsable={false}>
        <PreviewableUserAvatar
          size={42}
          profile={profile}
          moderation={moderation?.ui('avatar')}
          type={profile.associated?.labeler ? 'labeler' : 'user'}
          onBeforePress={onPress}
        />
      </View>
      <Link
        to={makeProfileLink(profile)}
        style={[a.flex_1]}
        label={name}
        onPress={() => onPress?.()}>
        <View style={[a.flex_1, a.align_start]}>
          <ProfileHoverCard did={profile.did} style={[a.w_full]}>
            <View style={[a.flex_row, a.align_center]}>
              <Text
                emoji
                numberOfLines={1}
                style={[
                  a.flex_shrink,
                  a.text_lg,
                  a.font_semi_bold,
                  a.leading_snug,
                ]}>
                {name}
              </Text>
              <View style={[a.pl_xs]}>
                <ProfileBadges
                  profile={profile}
                  size="md"
                  interactive={!onPress}
                />
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
              {sanitizeHandle(profile.handle, '@')}
            </Text>
          </ProfileHoverCard>
        </View>
      </Link>
    </View>
  )
}
