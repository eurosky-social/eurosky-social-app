import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * The account about to be deleted or deactivated, so it's clear which one when
 * several are signed in.
 */
export function AccountActionIdentity() {
  const t = useTheme()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const moderationOpts = useModerationOpts()
  const handle = sanitizeHandle(
    profile?.handle ?? currentAccount?.handle ?? '',
    '@',
  )
  const displayName = profile?.displayName
    ? sanitizeDisplayName(profile.displayName)
    : undefined

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.mb_lg,
        // Clears the web close button in the top-right corner.
        web({paddingRight: 32}),
      ]}>
      <UserAvatar
        size={40}
        avatar={profile?.avatar}
        moderation={
          profile && moderationOpts
            ? moderateProfile(profile, moderationOpts).ui('avatar')
            : undefined
        }
        type={profile?.associated?.labeler ? 'labeler' : 'user'}
      />
      <View style={[a.flex_1]}>
        {displayName ? (
          <Text
            emoji
            numberOfLines={1}
            style={[a.text_md, a.font_semi_bold, a.leading_snug, t.atoms.text]}>
            {displayName}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            displayName ? a.text_sm : [a.text_md, a.font_semi_bold],
            a.leading_snug,
            displayName ? t.atoms.text_contrast_medium : t.atoms.text,
          ]}>
          {handle}
        </Text>
      </View>
    </View>
  )
}
