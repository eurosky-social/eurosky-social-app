import {useLingui} from '@lingui/react/macro'

import {useSession} from '#/state/session'
import {type Props as IconProps} from '#/components/icons/common'
import {EVENT_FEED_IDS, EVENT_FEEDS, type EventFeedId} from './feeds'

export type EventFeedOption = {
  id: EventFeedId
  label: string
  icon?: React.ComponentType<IconProps>
}

/**
 * The feeds the current user can pick, shared by the in-screen tabs and the
 * desktop right rail so both list the same feeds with the same labels.
 */
export function useEventFeedOptions() {
  const {t: l} = useLingui()
  const {hasSession} = useSession()

  const labels: Record<EventFeedId, string> = {
    upcoming: l`Upcoming`,
    following: l({
      message: 'Following',
      comment:
        'Events feed tab listing events hosted by people the user follows.',
    }),
    '40verse': l({
      message: '40verse',
      comment: 'Name of the 40verse community events feed. Do not translate.',
    }),
    mine: l({
      message: 'My events',
      comment: 'Events feed tab listing the events the user has created.',
    }),
  }

  const options: EventFeedOption[] = EVENT_FEED_IDS.filter(
    id => hasSession || !EVENT_FEEDS[id].requiresAuth,
  ).map(id => ({id, label: labels[id], icon: EVENT_FEEDS[id].icon}))

  /**
   * Maps the `feed` route param to a feed the user can see, falling back to
   * `upcoming` for a missing or unknown param, or a feed that disappeared,
   * e.g. after signing out.
   */
  const resolveFeed = (param?: string): EventFeedId =>
    options.find(option => option.id === param)?.id ?? 'upcoming'

  return {options, resolveFeed}
}
