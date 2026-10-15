import {useState} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {AnimatedLikeIcon} from '#/lib/custom-animations/LikeIcon'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {
  Person_Filled_Corner2_Rounded as PersonFilledIcon,
  Person_Stroke2_Corner2_Rounded as PersonIcon,
} from '#/components/icons/Person'
import {
  PostControlButton,
  PostControlButtonIcon,
  PostControlButtonText,
} from '#/components/PostControls/PostControlButton'
import {useEventRsvpMutation, useViewerEventRsvpsQuery} from '../queries'
import {type EventRecord, type RsvpStatus} from '../types'

const GOING: RsvpStatus = 'community.lexicon.calendar.rsvp#going'
const INTERESTED: RsvpStatus = 'community.lexicon.calendar.rsvp#interested'

/**
 * "Interested" and "Going" toggles, built from a post's controls: an outline
 * icon with the count beside it, filled while active. Pressing the active one
 * removes the RSVP. Signed-out users are asked to sign in.
 */
export function EventRsvpButtons({event}: {event: EventRecord}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const requireAuth = useRequireAuth()
  const {data: viewerRsvp} = useViewerEventRsvpsQuery({
    select: rsvps => rsvps[event.uri],
  })
  const {mutate, isPending} = useEventRsvpMutation()
  const status = viewerRsvp?.status
  const interestedCount = event.rsvpsInterestedCount ?? 0
  const goingCount = event.rsvpsGoingCount ?? 0
  // Like a post's like button, the heart only animates after a press.
  const [hasInterestBeenToggled, setHasInterestBeenToggled] = useState(false)

  const onPress = (e: GestureResponderEvent, pressed: RsvpStatus) => {
    // Don't let the press reach the feed item's link.
    e.preventDefault()
    e.stopPropagation()
    requireAuth(() => {
      if (pressed === INTERESTED) setHasInterestBeenToggled(true)
      mutate({
        event,
        prev: viewerRsvp,
        next: status === pressed ? null : pressed,
      })
    })
  }

  const formatCount = (count: number) =>
    i18n.number(count, {notation: 'compact', maximumFractionDigits: 1})

  return (
    /*
     * Laid out like a post's controls: equal columns in a group capped at
     * 320px, with an empty third column where posts have their like button.
     */
    <View style={[a.flex_row, a.flex_1, {maxWidth: 320}]}>
      <View style={[a.flex_1, a.align_start, {marginLeft: -6}]}>
        <PostControlButton
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
          onPress={e => onPress(e, INTERESTED)}
          testID="eventInterestedBtn">
          <AnimatedLikeIcon
            isLiked={status === INTERESTED}
            hasBeenToggled={hasInterestBeenToggled}
          />
          {interestedCount > 0 && (
            <PostControlButtonText>
              {formatCount(interestedCount)}
            </PostControlButtonText>
          )}
        </PostControlButton>
      </View>
      <View style={[a.flex_1, a.align_start]}>
        <PostControlButton
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
          onPress={e => onPress(e, GOING)}
          testID="eventGoingBtn">
          <PostControlButtonIcon
            icon={status === GOING ? PersonFilledIcon : PersonIcon}
          />
          {goingCount > 0 && (
            <PostControlButtonText>
              {formatCount(goingCount)}
            </PostControlButtonText>
          )}
        </PostControlButton>
      </View>
      <View style={[a.flex_1]} />
    </View>
  )
}
