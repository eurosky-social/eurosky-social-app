import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useSession} from '#/state/session'
import {List} from '#/view/com/util/List'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {CreateOrEditEventDialog} from './components/CreateOrEditEventDialog'
import {EventFeedTabs} from './components/EventFeedTabs'
import {EventFiltersDialog} from './components/EventFiltersDialog'
import {EventItem} from './components/EventItem'
import {type EventFeedId} from './feeds'
import {
  type EventFilters,
  eventFiltersToRouteParams,
  hasActiveFilters,
  readEventFilters,
} from './filters'
import {useEventFeedQuery} from './queries'
import {type EventRecord} from './types'
import {useEventFeedOptions} from './useEventFeedOptions'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Events'>

export function EventsScreen({route, navigation}: Props) {
  const {rightNavVisible} = useLayoutBreakpoints()
  const {options, resolveFeed} = useEventFeedOptions()
  // The URL holds the selected feed so the desktop right rail can share it.
  const feed = resolveFeed(route.params?.feed)
  const filters = readEventFilters(route.params)
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const eventDialogControl = Dialog.useDialogControl()
  const [editingEvent, setEditingEvent] = useState<EventRecord>()

  const openEventDialog = (event?: EventRecord) => {
    setEditingEvent(event)
    eventDialogControl.open()
  }

  return (
    <Layout.Screen testID="eventsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Events</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <EventFiltersDialog
            filters={filters}
            onApply={next =>
              navigation.setParams(eventFiltersToRouteParams(next))
            }
          />
          {hasSession && (
            <Button
              label={l`New event`}
              color="secondary"
              size="small"
              onPress={() => openEventDialog()}
              testID="newEventBtn">
              <ButtonIcon icon={PlusIcon} />
              <ButtonText>
                <Trans context="action">New</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
      </Layout.Header.Outer>
      {/* The shell's right column lists the feeds on wide screens. */}
      {!(IS_WEB && rightNavVisible) && (
        <Layout.Center>
          <EventFeedTabs
            items={options}
            selectedId={feed}
            onSelect={id => navigation.setParams({feed: id})}
          />
        </Layout.Center>
      )}
      <EventsList feed={feed} filters={filters} onEdit={openEventDialog} />
      {hasSession && (
        <CreateOrEditEventDialog
          control={eventDialogControl}
          event={editingEvent}
          onSave={() => {
            // A new event shows up in "My events" first; see the save mutation.
            if (!editingEvent) navigation.setParams({feed: 'mine'})
          }}
        />
      )}
    </Layout.Screen>
  )
}

function EventsList({
  feed,
  filters,
  onEdit,
}: {
  feed: EventFeedId
  filters: EventFilters
  onEdit: (event: EventRecord) => void
}) {
  const t = useTheme()
  const {
    data,
    error,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEventFeedQuery(feed, filters)

  const events = data?.pages.flatMap(page => page.records) ?? []
  const profiles = new Map(
    data?.pages.flatMap(page => page.profiles ?? []).map(p => [p.did, p]),
  )

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !error) void fetchNextPage()
  }

  return (
    <List
      data={events}
      keyExtractor={(event: EventRecord) => event.uri}
      renderItem={({item}: {item: EventRecord}) => (
        <EventItem
          event={item}
          profile={profiles.get(item.did)}
          onEdit={() => onEdit(item)}
        />
      )}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      ListEmptyComponent={
        isLoading || error ? undefined : (
          <View style={[a.p_xl]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {hasActiveFilters(filters) ? (
                <Trans>No upcoming events with the selected filters.</Trans>
              ) : feed === 'mine' ? (
                <Trans>You haven’t created any events yet.</Trans>
              ) : feed === 'following' ? (
                <Trans>No upcoming events from people you follow.</Trans>
              ) : (
                <Trans>No upcoming events.</Trans>
              )}
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        <ListFooter
          isFetchingNextPage={isLoading || isFetchingNextPage}
          error={cleanError(error)}
          onRetry={() => refetch()}
        />
      }
      sideBorders={false}
    />
  )
}
