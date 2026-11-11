import {View} from 'react-native'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {useLingui} from '@lingui/react/macro'

import {sanitizeHandle} from '#/lib/strings/handles'
import {type Shadow} from '#/state/cache/profile-shadow'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {ProfileHeaderMetrics} from '#/screens/Profile/Header/Metrics'
import {atoms as a, useTheme, web} from '#/alf'
import {Link} from '#/components/Link'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {ProfileHeaderLinks} from '#/features/profileLinks'
import {PublisherFollowButton} from '#/features/publishers/FollowButton'
import {type app} from '#/lexicons'

/** Reuse profile counts and safe links, without a following count or extra profile chrome. */
export function PublisherProfileDetails({
  name,
  profile,
  moderationOpts,
}: {
  name: string
  profile: Shadow<app.bsky.actor.defs.ProfileViewDetailed>
  moderationOpts: ModerationOpts
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderation = moderateProfile(profile, moderationOpts)
  const description = new RichTextAPI({text: profile.description ?? ''})
  description.detectFacetsWithoutResolution()
  if (moderation.ui('profileView').blur) return null
  return (
    <View
      testID="publisherProfileDetails"
      style={[a.gap_md, a.py_lg, {minWidth: 0}]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Link
          testID="publisherIdentity"
          to={{screen: 'Profile', params: {name: profile.did}}}
          label={l`View ${name}’s profile`}
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_md,
            {minWidth: 0},
          ]}>
          <UserAvatar
            type="user"
            shape="square"
            size={64}
            avatar={profile.avatar}
            moderation={moderation.ui('avatar')}
          />
          <View style={[a.flex_1, a.gap_xs, {minWidth: 0}]}>
            <Text
              emoji
              accessibilityRole="header"
              numberOfLines={2}
              style={[a.font_bold, {fontSize: 28, lineHeight: 32}]}>
              {name}
            </Text>
            <Text
              style={[a.text_md, t.atoms.text_contrast_medium]}
              numberOfLines={1}>
              {sanitizeHandle(profile.handle, '@')}
            </Text>
          </View>
        </Link>
        <PublisherFollowButton
          profile={profile}
          moderationOpts={moderationOpts}
        />
      </View>
      <ProfileHeaderMetrics profile={profile} showFollowing={false} />
      {!!description.text && (
        <RichText
          testID="publisherDescription"
          value={description}
          enableTags
          selectable
          authorHandle={profile.handle}
          shouldProxyLinks
          style={[
            a.text_md,
            a.leading_relaxed,
            web({overflowWrap: 'anywhere'}),
          ]}
        />
      )}
      <ProfileHeaderLinks profile={profile} hidden={false} />
    </View>
  )
}
