import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {SubtleHover} from '#/components/SubtleHover'
import {usePrecacheEvent} from '../queries'
import {type EventProfile, type EventRecord} from '../types'
import {makeEventLink} from '../util'
import {CollapsibleText} from './CollapsibleText'
import * as Event from './Event'
import {EventFeedItemPosts} from './EventFeedItemPosts'
import {EventRsvpButtons} from './EventRsvpButtons'

/** An event in a feed. Pressing it opens the event's page, like a post. */
export function EventFeedItem({
  event,
  profile,
  onEdit,
}: {
  event: EventRecord
  profile?: EventProfile
  onEdit: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const precacheEvent = usePrecacheEvent()
  const description = event.value.description?.trim()

  return (
    <View style={[a.border_t, t.atoms.border_contrast_low]}>
      <Link
        to={makeEventLink(event)}
        label={l`View event “${event.value.name}”`}
        onPress={() => precacheEvent(event, profile)}
        style={[a.flex_col, a.align_stretch]}>
        {({hovered}) => (
          <>
            <SubtleHover hover={hovered} />
            <View style={[a.w_full, a.gap_sm, a.px_xl, a.pt_lg, a.pb_sm]}>
              <Event.Organizer did={event.did} profile={profile} />
              <Event.Banner event={event} />
              <View style={[a.gap_xs]}>
                <Event.Title name={event.value.name} style={[a.text_lg]} />
                <Event.Meta event={event} />
              </View>
              {description && (
                <CollapsibleText
                  numberOfLines={4}
                  maxChars={300}
                  expandLabel={l`Expand event description`}
                  style={[a.leading_snug]}>
                  {description}
                </CollapsibleText>
              )}
              <Event.Actions>
                <EventRsvpButtons event={event} />
                <Event.EditButton event={event} onPress={onEdit} />
              </Event.Actions>
            </View>
          </>
        )}
      </Link>
      {/* Outside the link: each post opens its own thread. */}
      <EventFeedItemPosts event={event} profile={profile} />
    </View>
  )
}
