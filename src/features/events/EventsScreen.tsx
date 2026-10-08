import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {List} from '#/view/com/util/List'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {EventFeedTabs} from './components/EventFeedTabs'
import {EventItem} from './components/EventItem'
import {type EventFeedId} from './feeds'
import {useEventFeedQuery} from './queries'
import {type EventRecord} from './types'
import {useEventFeedOptions} from './useEventFeedOptions'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Events'>

export function EventsScreen({route, navigation}: Props) {
  const {rightNavVisible} = useLayoutBreakpoints()
  const {options, resolveFeed} = useEventFeedOptions()
  // The URL holds the selected feed so the desktop right rail can share it.
  const feed = resolveFeed(route.params?.feed)

  return (
    <Layout.Screen testID="eventsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Events</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
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
      <EventsList feed={feed} />
    </Layout.Screen>
  )
}

function EventsList({feed}: {feed: EventFeedId}) {
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
  } = useEventFeedQuery(feed)

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
        <EventItem event={item} profile={profiles.get(item.did)} />
      )}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      ListEmptyComponent={
        isLoading || error ? undefined : (
          <View style={[a.p_xl]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {feed === 'mine' ? (
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
