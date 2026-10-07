import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Text} from '#/components/Typography'
import {Attend, AttendState} from '../icons/Attend'
import {Heart} from '../icons/Heart'
import {useEventRsvpMutation, useViewerEventRsvpsQuery} from '../queries'
import {type EventRecord, type RsvpStatus} from '../types'

const GOING: RsvpStatus = 'community.lexicon.calendar.rsvp#going'
const INTERESTED: RsvpStatus = 'community.lexicon.calendar.rsvp#interested'

/**
 * "Interested" and "Going" toggles, styled like a post's like button: an icon
 * with the count beside it. Pressing the active one removes the RSVP.
 * Signed-out users are asked to sign in.
 */
export function EventRsvpButtons({event}: {event: EventRecord}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const requireAuth = useRequireAuth()
  const {data: viewerRsvp} = useViewerEventRsvpsQuery({
    select: rsvps => rsvps[event.uri],
  })
  const {mutate, isPending} = useEventRsvpMutation()
  const status = viewerRsvp?.status
  const interestedCount = event.rsvpsInterestedCount ?? 0
  const goingCount = event.rsvpsGoingCount ?? 0

  const onPress = (pressed: RsvpStatus) => {
    requireAuth(() =>
      mutate({
        event,
        prev: viewerRsvp,
        next: status === pressed ? null : pressed,
      }),
    )
  }

  return (
    <View style={[a.flex_row, a.align_center, a.gap_lg, {marginLeft: -5}]}>
      <RsvpControl
        icon={Heart}
        count={interestedCount}
        active={status === INTERESTED}
        activeColor={t.palette.pink}
        disabled={isPending}
        label={
          status === INTERESTED
            ? l({
                message: `Remove interest (${plural(interestedCount, {
                  one: '# interested',
                  other: '# interested',
                })})`,
                comment:
                  'Accessibility label for the event “interested” button when the user is interested, followed by the number of interested people',
              })
            : l({
                message: `Interested (${plural(interestedCount, {
                  one: '# interested',
                  other: '# interested',
                })})`,
                comment:
                  'Accessibility label for the event “interested” button, followed by the number of interested people',
              })
        }
        onPress={() => onPress(INTERESTED)}
      />
      <RsvpControl
        icon={status === GOING ? AttendState : Attend}
        count={goingCount}
        active={status === GOING}
        activeColor={t.palette.primary_500}
        disabled={isPending}
        label={
          status === GOING
            ? l({
                message: `Not going anymore (${plural(goingCount, {
                  one: '# going',
                  other: '# going',
                })})`,
                comment:
                  'Accessibility label for the event “going” button when the user is going, followed by the number of people going',
              })
            : l({
                message: `Going (${plural(goingCount, {
                  one: '# going',
                  other: '# going',
                })})`,
                comment:
                  'Accessibility label for the event “going” button, followed by the number of people going',
              })
        }
        onPress={() => onPress(GOING)}
      />
    </View>
  )
}

/** Icon plus count, matching the look of a post's like button. */
function RsvpControl({
  icon: Icon,
  count,
  active,
  activeColor,
  disabled,
  label,
  onPress,
}: {
  icon: React.ComponentType<SVGIconProps>
  count: number
  active: boolean
  activeColor: string
  disabled: boolean
  label: string
  onPress: () => void
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const playHaptic = useHaptics()
  const color = {color: active ? activeColor : t.palette.contrast_500}

  return (
    <Button
      label={label}
      onPress={() => {
        playHaptic('Light')
        onPress()
      }}
      disabled={disabled}
      shape="round"
      variant="ghost"
      color="secondary"
      hoverStyle={t.atoms.bg_contrast_25}
      hitSlop={{top: 5, bottom: 10, left: 10, right: 10}}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.bg_transparent,
        {padding: 5},
      ]}>
      <Icon width={18} style={[color, a.pointer_events_none]} />
      {count > 0 && (
        <Text
          style={[
            a.text_sm,
            a.user_select_none,
            active && a.font_semi_bold,
            color,
            // Prevents layout shift on Android.
            {includeFontPadding: false, textAlignVertical: 'center'},
          ]}>
          {i18n.number(count, {notation: 'compact', maximumFractionDigits: 1})}
        </Text>
      )}
    </Button>
  )
}
