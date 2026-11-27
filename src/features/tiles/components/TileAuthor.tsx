import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
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
 * The author of a tile where there is room to say who they are: the avatar,
 * the name with the check when they are one of our verified accounts, and
 * the handle under it. Used where a tile is shown by itself (its info sheet,
 * its own page); the card of a tile post has the one-line `TileAuthorLine`.
 * The whole row links to the author's profile.
 */
export function TileAuthorRow({
  author,
  onPress,
}: {
  author: TileAuthor
  /** Runs as the link is followed, e.g. to close the dialog it is in. */
  onPress?: () => void
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
  const handle = sanitizeHandle(profile.handle, '@')
  // A name that moderation hides leaves the handle to stand in for it.
  const title = name || handle

  return (
    <Link
      to={makeProfileLink(profile)}
      label={l`View ${title}'s profile`}
      onPress={() => onPress?.()}
      style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
      <UserAvatar
        type="user"
        size={36}
        avatar={profile.avatar}
        moderation={moderation?.ui('avatar')}
      />
      <View style={[a.flex_1]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <Text
            emoji
            numberOfLines={1}
            style={[
              a.flex_shrink,
              a.text_md,
              a.font_semi_bold,
              a.leading_snug,
            ]}>
            {title}
          </Text>
          {author.trusted && (
            <VerificationCheck
              width={14}
              fill={t.palette.primary_500}
              verifier={false}
            />
          )}
        </View>
        {name ? (
          <Text
            emoji
            numberOfLines={1}
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {handle}
          </Text>
        ) : null}
      </View>
    </Link>
  )
}
