import {type LiveEvent} from '../events'
import {useLiveAnchorQuery, useLiveEventQuery} from '../queries'
import {LiveThreadPanel as Panel} from './LiveThread'

/**
 * Resolves the event and its anchor for the split view's thread column; the
 * queries are shared with the screen through the query cache.
 */
export function LiveThreadPanel({eventId}: {eventId?: string}) {
  const {data: event} = useLiveEventQuery(eventId)
  if (!event) return null
  return <Resolved event={event} />
}

function Resolved({event}: {event: LiveEvent}) {
  const {data: anchorUri, isLoading} = useLiveAnchorQuery(event)
  return <Panel event={event} anchorUri={anchorUri} anchorLoading={isLoading} />
}
