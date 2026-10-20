import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {HITSLOP_20} from '#/lib/constants'
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
import {useThemeName} from '#/features/news/dutch/queries'
import {OutletIcon} from '#/features/news/explore/components/OutletIcon'
import {getPublisherName} from '#/features/news/publishers'
import {toSingleParagraph} from '#/features/news/text'
import {type app} from '#/lexicons'
import {type Frontpage, frontpagePath, topThemes} from '../frontpages'

export function FrontpageMasthead({frontpage}: {frontpage: Frontpage}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const themeName = useThemeName()
  const accent = frontpage.accent ?? t.palette.primary_500
  /*
   * Where the outlet has a Bluesky account, the masthead is its live profile:
   * avatar, name, bio, follow. Otherwise it is the outlet as the aggregator
   * knows it - its name, its site's icon, and a link out to the site.
   */
  const {data: profile} = useProfileQuery({did: frontpage.did})
  const name = getPublisherName(profile) || frontpage.name
  const bio = profile?.description && toSingleParagraph(profile.description)
  const site = frontpage.domains[0]
  const homeLink = frontpage.did
    ? makeProfileLink({
        did: frontpage.did,
        handle: profile?.handle ?? frontpage.did,
      })
    : site
      ? `https://${site}`
      : undefined
  const homeLabel = frontpage.did ? l`View ${name}’s profile` : l`Open ${site}`

  /* What it covers, by its current stories: its sections, in effect. */
  const themes = topThemes(frontpage, 4)
  const categoryChips = themes.length > 0 && (
    <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
      {themes.map(theme => (
        <View
          key={theme}
          style={[a.px_md, a.py_xs, a.rounded_full, t.atoms.bg_contrast_50]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {themeName(theme)}
          </Text>
        </View>
      ))}
    </View>
  )

  const avatar = frontpage.did ? (
    <UserAvatar
      did={frontpage.did}
      type="user"
      shape="square"
      size={56}
      avatar={profile?.avatar}
    />
  ) : (
    <OutletIcon
      outlet={{id: frontpage.slug, name: frontpage.name, site, categories: []}}
      size={56}
    />
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
        {homeLink ? (
          <Link to={homeLink} label={homeLabel}>
            {avatar}
          </Link>
        ) : (
          avatar
        )}

        {/* Everything beside the avatar shares one column, so the bio and the
         * topic chips line up under the same left edge. */}
        <View style={[a.flex_1, a.gap_xs]}>
          <View
            style={[a.flex_row, a.align_start, a.justify_between, a.gap_md]}>
            <Link
              to={homeLink ?? frontpagePath(frontpage)}
              label={homeLabel}
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
                  {name}
                </Text>
                {profile && <PublisherVerification profile={profile} />}
              </View>
              {profile ? (
                <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {sanitizeHandle(profile.handle, '@')}
                </Text>
              ) : (
                !!site && (
                  <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                    {site}
                  </Text>
                )
              )}
            </Link>

            {profile && (
              <PublisherFollowButton profile={profile} accent={accent} />
            )}
          </View>

          {!!bio && (
            <Text
              emoji
              numberOfLines={2}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {bio}
            </Text>
          )}

          {/* On wider screens the chips align under the bio; on mobile they
           * break out to full width below the row (see outside this column). */}
          {gtMobile && categoryChips && (
            <View style={[a.pt_2xs]}>{categoryChips}</View>
          )}
        </View>
      </View>

      {/* Topic chips, full width on mobile. Display-only. */}
      {!gtMobile && categoryChips && (
        <View style={[a.px_lg, a.pb_md]}>{categoryChips}</View>
      )}

      <Divider />
    </View>
  )
}

// The local shadow only drives the accent tint (shown while unfollowed);
// FollowButton tracks its own follow state.
function PublisherFollowButton({
  profile,
  accent,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
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
  profile: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const shadowed = useProfileShadow(profile)
  return (
    <VerificationCheckButton
      profile={shadowed}
      width={18}
      hitSlop={HITSLOP_20}
    />
  )
}
