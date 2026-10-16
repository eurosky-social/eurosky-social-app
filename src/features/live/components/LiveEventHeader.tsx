import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {simpleAreDatesEqual} from '#/lib/strings/time'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfileQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {useActorStatus} from '#/features/liveNow'
import {readableAccent} from '#/features/newsrooms/accent'
import {type app} from '#/lexicons'
import {getLiveEventState, type LiveEvent} from '../events'

/**
 * Title, host row and running order under the player. The host's avatar
 * carries the live ring when the account has set its Live Now status, so
 * mu's curated event and the host's own signal agree.
 */
export function LiveEventHeader({event}: {event: LiveEvent}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const {data: profile} = useProfileQuery({did: event.hostDid})
  const state = getLiveEventState(event)
  const accent = readableAccent(event.accent, t)
  const now = Date.now()

  return (
    <View style={[a.px_lg, a.pt_md, a.pb_sm, a.gap_md]}>
      <View style={[a.gap_xs]}>
        <Text
          emoji
          style={[a.text_xl, a.font_bold, a.leading_tight, t.atoms.text]}>
          {event.title}
        </Text>
        {!!event.description && (
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {event.description}
          </Text>
        )}
      </View>

      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        {profile ? (
          <HostAvatar profile={profile} />
        ) : (
          <ProfileCard.AvatarPlaceholder size={40} />
        )}
        <View style={[a.flex_1, a.gap_2xs]}>
          {profile ? (
            <Link
              to={makeProfileLink(profile)}
              label={sanitizeHandle(profile.handle, '@')}
              style={[a.flex_col, a.align_start]}>
              <Text
                emoji
                numberOfLines={1}
                style={[a.text_md, a.font_bold, t.atoms.text]}>
                {sanitizeDisplayName(
                  profile.displayName || sanitizeHandle(profile.handle),
                )}
              </Text>
            </Link>
          ) : (
            <ProfileCard.NamePlaceholder />
          )}
          <Text
            numberOfLines={1}
            style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {profile ? sanitizeHandle(profile.handle, '@') : ''}
            {' · '}
            {state === 'live' ? (
              simpleAreDatesEqual(new Date(event.startsAt), new Date(now)) ? (
                <Trans>
                  started{' '}
                  {i18n.date(new Date(event.startsAt), {timeStyle: 'short'})}
                </Trans>
              ) : (
                <Trans>
                  live since{' '}
                  {i18n.date(new Date(event.startsAt), {dateStyle: 'medium'})}
                </Trans>
              )
            ) : state === 'upcoming' ? (
              <Trans>
                starts{' '}
                {i18n.date(new Date(event.startsAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Trans>
            ) : (
              <Trans>
                ended{' '}
                {i18n.date(new Date(event.endsAt ?? event.startsAt), {
                  dateStyle: 'medium',
                })}
              </Trans>
            )}
          </Text>
        </View>
        {profile && <HostFollowButton profile={profile} accent={accent} />}
      </View>

      {event.runningOrder && event.runningOrder.length > 0 && (
        <View style={[a.gap_xs, a.pt_xs]}>
          <Text
            style={[
              a.text_xs,
              a.font_bold,
              t.atoms.text_contrast_medium,
              {letterSpacing: 0.4},
            ]}>
            <Trans>RUNNING ORDER</Trans>
          </Text>
          {event.runningOrder.map((item, i) => {
            const start = new Date(item.at).getTime()
            const next = event.runningOrder?.[i + 1]
            const end = next
              ? new Date(next.at).getTime()
              : event.endsAt
                ? new Date(event.endsAt).getTime()
                : Infinity
            const isNow = state === 'live' && now >= start && now < end
            const isPast = now >= end
            return (
              <View
                key={item.at}
                style={[a.flex_row, a.align_center, a.gap_md]}>
                <Text
                  style={[
                    a.text_sm,
                    a.font_semi_bold,
                    {minWidth: 64, flexShrink: 0},
                    isNow
                      ? {color: t.palette.primary_500}
                      : t.atoms.text_contrast_medium,
                  ]}>
                  {i18n.date(new Date(item.at), {timeStyle: 'short'})}
                </Text>
                <Text
                  style={[
                    a.text_sm,
                    a.flex_1,
                    isNow && a.font_semi_bold,
                    isPast ? t.atoms.text_contrast_medium : t.atoms.text,
                  ]}>
                  {item.label}
                </Text>
                {isNow && (
                  <View
                    style={[
                      a.rounded_xs,
                      a.px_xs,
                      {
                        paddingVertical: 1,
                        backgroundColor: t.palette.primary_500,
                      },
                    ]}>
                    <Text
                      style={[
                        a.text_2xs,
                        a.font_semi_bold,
                        {color: t.palette.white},
                      ]}>
                      <Trans comment="Marks the current item in a running order">
                        NOW
                      </Trans>
                    </Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function HostAvatar({
  profile,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const status = useActorStatus(profile)
  return (
    <UserAvatar
      type="user"
      size={40}
      avatar={profile.avatar}
      live={status.isActive}
    />
  )
}

/**
 * The local shadow only drives the accent tint (shown while unfollowed);
 * FollowButton tracks its own follow state.
 */
function HostFollowButton({
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
