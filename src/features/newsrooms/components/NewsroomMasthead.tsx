import {View} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {Link} from '#/components/Link'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {VerificationCheckButton} from '#/components/verification/VerificationCheckButton'
import {type NewsroomPublisher} from '../publishers'

export function NewsroomMasthead({publisher}: {publisher: NewsroomPublisher}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const accent = publisher.accent ?? t.palette.primary_500
  // The masthead is the publisher's real Bluesky profile: a link out to it, with
  // their live avatar and bio. Fall back to the registry tagline before the
  // profile loads or if the account has no bio.
  const {data: profile} = useProfileQuery({did: publisher.did})
  const bio = profile?.description?.trim() || publisher.tagline
  const profilePath = makeProfileLink({
    did: publisher.did,
    handle: publisher.handle,
  })

  const categoryChips = publisher.categories.length > 0 && (
    <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
      {publisher.categories.map(category => (
        <View
          key={category}
          style={[a.px_md, a.py_xs, a.rounded_full, t.atoms.bg_contrast_25]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {category}
          </Text>
        </View>
      ))}
    </View>
  )

  return (
    <View style={[a.pb_sm]}>
      <View
        style={[
          a.px_lg,
          a.pt_lg,
          a.pb_md,
          a.flex_row,
          a.align_start,
          a.gap_md,
        ]}>
        <Link
          to={profilePath}
          label={l`View ${publisher.displayName}’s profile`}>
          <UserAvatar
            type="user"
            shape="square"
            size={56}
            avatar={profile?.avatar}
          />
        </Link>

        {/* Everything beside the avatar shares one column, so the bio and the
         * topic chips line up under the same left edge. */}
        <View style={[a.flex_1, a.gap_xs]}>
          <View
            style={[a.flex_row, a.align_start, a.justify_between, a.gap_md]}>
            <Link
              to={profilePath}
              label={l`View ${publisher.displayName}’s profile`}
              style={[a.flex_1, a.flex_col, a.align_start, a.gap_2xs]}>
              <View style={[a.flex_row, a.align_center, a.gap_xs, a.w_full]}>
                <Text
                  emoji
                  style={[
                    a.text_2xl,
                    a.font_bold,
                    a.leading_tight,
                    a.flex_shrink,
                    t.atoms.text,
                  ]}>
                  {publisher.displayName}
                </Text>
                {profile && <PublisherVerification profile={profile} />}
              </View>
              <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
                {sanitizeHandle(publisher.handle, '@')}
              </Text>
            </Link>

            {profile && (
              <PublisherFollowButton profile={profile} accent={accent} />
            )}
          </View>

          <Text
            emoji
            numberOfLines={2}
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {bio}
          </Text>

          {/* On wider screens the chips align under the bio; on mobile they
           * break out to full width below the row (see outside this column). */}
          {gtMobile && categoryChips && (
            <View style={[a.pt_2xs]}>{categoryChips}</View>
          )}
        </View>
      </View>

      {/* Category filter chips, full width on mobile. Display-only in P0. */}
      {!gtMobile && categoryChips && (
        <View style={[a.px_lg, a.pb_md]}>{categoryChips}</View>
      )}

      <Divider />
    </View>
  )
}

/**
 * A regular Bluesky account follow (the standard mutation, toasts, and
 * follow-back handling), tinted in the publisher's accent while unfollowed.
 * The local shadow only drives the tint; FollowButton tracks its own state.
 */
function PublisherFollowButton({
  profile,
  accent,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
  accent: string
}) {
  const moderationOpts = useModerationOpts()
  const shadowed = useProfileShadow(profile)
  if (!moderationOpts) return null
  return (
    <ProfileCard.FollowButton
      profile={profile}
      moderationOpts={moderationOpts}
      logContext="ProfileCard"
      size="small"
      style={shadowed.viewer?.following ? undefined : {backgroundColor: accent}}
    />
  )
}

// Split out so the profile-shadow hook only runs once the publisher's real
// profile has loaded; renders the standard verification badge (and nothing when
// the account isn't verified).
function PublisherVerification({
  profile,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
}) {
  const shadowed = useProfileShadow(profile)
  return <VerificationCheckButton profile={shadowed} width={18} />
}
