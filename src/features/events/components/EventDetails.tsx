import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {Text} from '#/components/Typography'
import {type EventProfile, type EventRecord} from '../types'
import * as Event from './Event'
import {EventAttendees} from './EventAttendees'
import {EventRsvpButtons} from './EventRsvpButtons'

/** The event at the top of its own page, with its full description. */
export function EventDetails({
  event,
  profile,
  onEdit,
}: {
  event: EventRecord
  profile?: EventProfile
  onEdit: () => void
}) {
  const description = event.value.description?.trim()

  return (
    <View style={[a.gap_md, a.px_xl, a.pt_lg, a.pb_sm]}>
      <Event.Organizer did={event.did} profile={profile} />
      <Event.Banner event={event} />
      <View style={[a.gap_xs]}>
        <Event.Title name={event.value.name} style={[a.text_2xl]} />
        <Event.Meta event={event} />
      </View>
      {description && (
        <Text emoji selectable style={[a.text_md, a.leading_snug]}>
          {description}
        </Text>
      )}
      <Event.Actions>
        <EventRsvpButtons event={event} />
        <Event.EditButton event={event} onPress={onEdit} />
      </Event.Actions>
      <EventAttendees event={event} />
    </View>
  )
}
