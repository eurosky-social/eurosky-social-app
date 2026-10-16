import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {STALE} from '#/state/queries'
import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {getLiveEventState, getLiveEventThumb, type LiveEvent} from '../events'
import {LivePill} from './LivePill'

/** One event in the Live index: image, state, title, host. */
export function LiveEventCard({event}: {event: LiveEvent}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const {data: host} = useProfileQuery({
    did: event.hostDid,
    staleTime: STALE.MINUTES.FIVE,
  })
  const state = getLiveEventState(event)
  const thumb = getLiveEventThumb(event)
  const hostName = host
    ? sanitizeDisplayName(host.displayName || sanitizeHandle(host.handle))
    : ''

  return (
    <Link
      to={`/live/${event.id}`}
      label={event.title}
      style={[a.flex_col, a.w_full]}>
      {({hovered, pressed}) => (
        <View
          style={[
            a.w_full,
            a.rounded_md,
            a.border,
            a.overflow_hidden,
            t.atoms.border_contrast_low,
            hovered || pressed ? t.atoms.bg_contrast_25 : t.atoms.bg,
          ]}>
          <View
            style={[
              a.w_full,
              a.relative,
              {aspectRatio: 16 / 9},
              t.atoms.bg_contrast_50,
            ]}>
            {thumb && (
              <Image
                source={{uri: thumb}}
                style={[a.absolute, a.inset_0]}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            )}
            <View style={[a.absolute, {top: 10, left: 10}]}>
              {state === 'live' ? (
                <LivePill />
              ) : (
                <View
                  style={[
                    a.rounded_xs,
                    a.px_xs,
                    {paddingVertical: 2, backgroundColor: t.palette.white},
                  ]}>
                  <Text
                    style={[
                      a.text_2xs,
                      a.font_semi_bold,
                      {color: t.palette.contrast_950, letterSpacing: 0.4},
                    ]}>
                    {state === 'upcoming' ? (
                      i18n
                        .date(new Date(event.startsAt), {
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        .toUpperCase()
                    ) : (
                      <Trans comment="Badge on a finished broadcast">
                        REPLAY
                      </Trans>
                    )}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={[a.p_md, a.gap_xs]}>
            <Text
              emoji
              numberOfLines={2}
              style={[a.text_md, a.font_bold, a.leading_snug, t.atoms.text]}>
              {event.title}
            </Text>
            {!!hostName && (
              <Text
                emoji
                numberOfLines={1}
                style={[a.text_xs, t.atoms.text_contrast_medium]}>
                {hostName}
              </Text>
            )}
          </View>
        </View>
      )}
    </Link>
  )
}
