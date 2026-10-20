import {type GestureResponderEvent} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useProfilesQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {AvatarStack} from '#/components/AvatarStack'
import {Button} from '#/components/Button'
import {Text} from '#/components/Typography'
import {EVENT_ATTENDEES_SHOWN} from '../config'
import {useFollowingEventRsvpsQuery, usePrecacheEvent} from '../queries'
import {type EventProfile, type EventRecord, type FollowingRsvp} from '../types'

/**
 * Avatars of a few people going to or interested in the event, people the
 * viewer follows first, beside how many are going (or interested, when nobody
 * is going yet). Pressing it opens the full list of RSVPs. Renders nothing
 * when nobody has RSVP'd.
 */
export function EventAttendees({
  event,
  profile,
}: {
  event: EventRecord
  profile?: EventProfile
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const precacheEvent = usePrecacheEvent()
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

  const onPress = (e: GestureResponderEvent) => {
    // Don't let the press reach the feed item's link.
    e.preventDefault()
    e.stopPropagation()
    precacheEvent(event, profile)
    navigation.navigate('EventRsvps', {
      name: event.did,
      rkey: event.rkey,
      tab: goingCount > 0 ? 'going' : 'interested',
    })
  }

  return (
    <Button
      label={l`See who RSVP’d to this event`}
      onPress={onPress}
      style={[a.self_start, a.flex_row, a.align_center, a.gap_xs, a.my_sm]}>
      {dids.length > 0 && (
        <AvatarStack profiles={profiles} numPending={dids.length} size={18} />
      )}
      {(goingCount > 0 || interestedCount > 0) && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {goingCount > 0 ? (
            <Trans>
              <Text style={[a.font_semi_bold]}>{goingCount}</Text>{' '}
              {plural(goingCount, {
                one: 'person is going',
                other: 'people are going',
              })}
            </Trans>
          ) : (
            <Trans>
              <Text style={[a.font_semi_bold]}>{interestedCount}</Text>{' '}
              {plural(interestedCount, {
                one: 'person is interested',
                other: 'people are interested',
              })}
            </Trans>
          )}
        </Text>
      )}
    </Button>
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
