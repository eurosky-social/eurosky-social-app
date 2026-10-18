import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {useQueries} from '@tanstack/react-query'

import {cleanError} from '#/lib/strings/errors'
import {STALE} from '#/state/queries'
import {useSession} from '#/state/session'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {type OsoPillKind} from '#/features/osoNav/pills'
import {OsoSectionHeader} from '#/features/osoNav/SectionHeader'
import {getEvent} from '../api'
import {type EventFilters, type EventSort} from '../filters'
import {
  createEventQueryKey,
  useEventFeedQuery,
  useViewerEventRsvpsQuery,
} from '../queries'
import {type EventProfile, type EventRecord, type RsvpStatus} from '../types'
import {EventItem} from './EventItem'

const GOING: RsvpStatus = 'community.lexicon.calendar.rsvp#going'
const INTERESTED: RsvpStatus = 'community.lexicon.calendar.rsvp#interested'

/** How many RSVP'd events each section looks up, nearest first. */
const MAX_RSVP_EVENTS = 30

type Item =
  | {type: 'header'; key: string; kind: OsoPillKind}
  | {type: 'event'; key: string; event: EventRecord; profile?: EventProfile}

/**
 * Oso's "My events" tab: the events the user created, then the upcoming
 * events they are going to, then those they are interested in. Each section
 * shows only when it has events.
 */
export function MyEventsSections({
  filters,
  sort,
  onEdit,
}: {
  filters: EventFilters
  sort: EventSort
  onEdit: (event: EventRecord) => void
}) {
  const t = useTheme()
  const {currentAccount} = useSession()
  const created = useEventFeedQuery('mine', filters, sort)
  const {data: rsvps, isLoading: isLoadingRsvps} = useViewerEventRsvpsQuery()

  const createdEvents = created.data?.pages.flatMap(page => page.records) ?? []
  const profiles = new Map(
    created.data?.pages
      .flatMap(page => page.profiles ?? [])
      .map(p => [p.did, p]),
  )

  // Events the user RSVP'd to, skipping their own (already listed above).
  const rsvpUris = Object.entries(rsvps ?? {})
    .filter(([, rsvp]) => rsvp.status === GOING || rsvp.status === INTERESTED)
    .map(([uri]) => uri)
    .filter(uri => !uri.startsWith(`at://${currentAccount?.did}/`))
  const rsvpQueries = useQueries({
    queries: rsvpUris.slice(0, MAX_RSVP_EVENTS * 2).map(uri => ({
      queryKey: createEventQueryKey({uri}),
      queryFn: ({signal}: {signal: AbortSignal}) =>
        getEvent({uri, profiles: true}, signal),
      staleTime: STALE.MINUTES.FIVE,
    })),
  })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const rsvpEvents = rsvpQueries
    .map(query => query.data)
    .filter((event): event is NonNullable<typeof event> => !!event)
    // Upcoming only, like the other event lists.
    .filter(event => {
      const start = startsAt(event)
      return !start || start >= startOfToday
    })
    .sort(
      (x, y) =>
        (startsAt(x)?.getTime() ?? Infinity) -
        (startsAt(y)?.getTime() ?? Infinity),
    )
  for (const event of rsvpEvents) {
    for (const profile of event.profiles ?? [])
      profiles.set(profile.did, profile)
  }
  const going = rsvpEvents.filter(e => rsvps?.[e.uri]?.status === GOING)
  const interested = rsvpEvents.filter(
    e => rsvps?.[e.uri]?.status === INTERESTED,
  )

  const items: Item[] = []
  const addSection = (kind: OsoPillKind, events: EventRecord[]) => {
    if (events.length === 0) return
    items.push({type: 'header', key: `header-${kind}`, kind})
    for (const event of events.slice(0, MAX_RSVP_EVENTS)) {
      items.push({
        type: 'event',
        key: `${kind}-${event.uri}`,
        event,
        profile: profiles.get(event.did),
      })
    }
  }
  addSection('eventsCreated', createdEvents)
  addSection('eventsGoing', going)
  addSection('eventsInterested', interested)

  const isLoading =
    created.isLoading ||
    isLoadingRsvps ||
    rsvpQueries.some(query => query.isLoading)

  return (
    <List
      data={items}
      keyExtractor={(item: Item) => item.key}
      renderItem={({item}: {item: Item}) =>
        item.type === 'header' ? (
          <OsoSectionHeader kind={item.kind} />
        ) : (
          <EventItem
            event={item.event}
            profile={item.profile}
            onEdit={() => onEdit(item.event)}
          />
        )
      }
      refreshing={created.isRefetching}
      onRefresh={() => void created.refetch()}
      ListEmptyComponent={
        isLoading || created.error ? undefined : (
          <View style={[a.p_xl]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>
                You haven’t created, joined or saved any upcoming events yet.
              </Trans>
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        <ListFooter
          isFetchingNextPage={isLoading}
          error={cleanError(created.error)}
          onRetry={() => created.refetch()}
        />
      }
      sideBorders={false}
    />
  )
}

/** Record timestamps can be malformed (`{}`), so parse defensively. */
function startsAt(event: EventRecord): Date | undefined {
  const value = event.value.startsAt
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}
