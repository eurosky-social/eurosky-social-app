import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {EventItem} from './components/EventItem'
import {useUpcomingEventsQuery} from './queries'
import {type EventRecord} from './types'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Events'>

export function EventsScreen({}: Props) {
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
      <EventsList />
    </Layout.Screen>
  )
}

function EventsList() {
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
  } = useUpcomingEventsQuery()

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
              <Trans>No upcoming events.</Trans>
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
