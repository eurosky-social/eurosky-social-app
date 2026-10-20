import {View} from 'react-native'
import {Plural} from '@lingui/react/macro'

import {useProfilesQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {AvatarStack} from '#/components/AvatarStack'
import {Text} from '#/components/Typography'
import {EVENT_ATTENDEES_SHOWN} from '../config'
import {useFollowingEventRsvpsQuery} from '../queries'
import {type EventRecord, type FollowingRsvp} from '../types'

/**
 * Avatars of a few people going to or interested in the event, people the
 * viewer follows first, beside how many are going (or interested, when nobody
 * is going yet). Renders nothing when nobody has RSVP'd.
 */
export function EventAttendees({event}: {event: EventRecord}) {
  const t = useTheme()
  const {data: friends, isLoading: isLoadingFriends} =
    useFollowingEventRsvpsQuery({
      select: rsvps => rsvps.filter(rsvp => rsvp.eventUri === event.uri),
    })
  const dids = pickEventAttendees(event, friends ?? [], EVENT_ATTENDEES_SHOWN)
  // Wait for the viewer's follows, so the stack isn't fetched twice.
  const {data} = useProfilesQuery({handles: isLoadingFriends ? [] : dids})

  const goingCount = event.rsvpsGoingCount ?? 0
  const interestedCount = event.rsvpsInterestedCount ?? 0
  if (dids.length === 0 && goingCount === 0 && interestedCount === 0) {
    return null
  }

  // getProfiles drops accounts it can't find and doesn't promise an order.
  const profiles = [...(data?.profiles ?? [])].sort(
    (x, y) => dids.indexOf(x.did) - dids.indexOf(y.did),
  )

  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs, a.my_sm]}>
      {dids.length > 0 && (
        <AvatarStack profiles={profiles} numPending={dids.length} size={18} />
      )}
      {(goingCount > 0 || interestedCount > 0) && (
        <Text
          style={[a.text_sm, t.atoms.text_contrast_medium, a.font_semi_bold]}>
          {goingCount > 0 ? (
            <Plural
              value={goingCount}
              one="# person is going"
              other="# people are going"
            />
          ) : (
            <Plural
              value={interestedCount}
              one="# person is interested"
              other="# people are interested"
            />
          )}
        </Text>
      )}
    </View>
  )
}

/**
 * DIDs of the attendees to show for an event: people the viewer follows
 * first, then anyone else, going before interested within each, without
 * duplicates. `friends` are the viewer's follows' RSVPs to this event.
 */
export function pickEventAttendees(
  event: EventRecord,
  friends: FollowingRsvp[],
  max: number,
): string[] {
  const dids = new Set<string>()
  for (const status of ['going', 'interested'] as const) {
    for (const rsvp of friends) {
      if (rsvp.status === status) dids.add(rsvp.did)
    }
  }
  for (const status of [
    'community.lexicon.calendar.rsvp#going',
    'community.lexicon.calendar.rsvp#interested',
  ] as const) {
    for (const rsvp of event.rsvps?.[status] ?? []) dids.add(rsvp.did)
  }
  return [...dids].slice(0, max)
}
