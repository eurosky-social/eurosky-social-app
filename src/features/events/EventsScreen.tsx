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
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {EventFeedTabs} from './components/EventFeedTabs'
import {EventItem} from './components/EventItem'
import {EVENT_FEED_IDS, EVENT_FEEDS, type EventFeedId} from './feeds'
import {useEventFeedQuery} from './queries'
import {type EventRecord} from './types'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Events'>

export function EventsScreen({}: Props) {
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const [selectedFeed, setSelectedFeed] = useState<EventFeedId>('upcoming')

  const feedIds = EVENT_FEED_IDS.filter(
    id => hasSession || !EVENT_FEEDS[id].requiresAuth,
  )
  // Fall back if the selected feed disappeared, e.g. after signing out.
  const feed = feedIds.includes(selectedFeed) ? selectedFeed : 'upcoming'

  const feedLabels: Record<EventFeedId, string> = {
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
      <Layout.Center>
        <EventFeedTabs
          items={feedIds.map(id => ({
            id,
            label: feedLabels[id],
            icon: EVENT_FEEDS[id].icon,
          }))}
          selectedId={feed}
          onSelect={setSelectedFeed}
        />
      </Layout.Center>
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

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !error) void fetchNextPage()
  }

  return (
    <List
      data={events}
      keyExtractor={(event: EventRecord) => event.uri}
      renderItem={({item}: {item: EventRecord}) => <EventItem event={item} />}
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
