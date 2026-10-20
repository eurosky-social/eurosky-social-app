import {useState} from 'react'
import {View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'

import {useInitialNumToRender} from '#/lib/hooks/useInitialNumToRender'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useResolveUriQuery} from '#/state/queries/resolve-uri'
import {Pager} from '#/view/com/pager/Pager'
import {TabBar} from '#/view/com/pager/TabBar'
import {ProfileCardWithFollowBtn} from '#/view/com/profile/ProfileCard'
import {List} from '#/view/com/util/List'
import {atoms as a, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter, ListMaybePlaceholder} from '#/components/Lists'
import {type app} from '#/lexicons'
import {EventsApiError} from './api'
import {EVENT_NSID} from './config'
import {
  type EventRsvpsStatus,
  useEventFriendRsvpsQuery,
  useEventQuery,
  useEventRsvpsQuery,
} from './queries'
import {type EventRecord} from './types'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'EventRsvps'>

const TABS: EventRsvpsStatus[] = ['interested', 'going']

/**
 * The people who RSVP'd to an event, in an "Interested" and a "Going" tab,
 * like a post's "Liked by" screen. `?tab=` picks the tab it opens on.
 */
export function EventRsvpsScreen({route}: Props) {
  const {name, rkey, tab} = route.params
  const {t: l} = useLingui()
  const {data: resolved, error: resolveError} = useResolveUriQuery(
    AtUri.make(name, EVENT_NSID, rkey).toString(),
  )
  const {
    data: event,
    error: eventError,
    refetch,
  } = useEventQuery({uri: resolved?.uri})
  const notFound =
    eventError instanceof EventsApiError && eventError.status === 404
  const error = resolveError ?? (notFound ? null : eventError)

  if (!event) {
    return (
      <Layout.Screen testID="eventRsvpsScreen">
        <Header />
        <ListMaybePlaceholder
          isLoading={!error && !notFound}
          isError={!!error}
          errorMessage={cleanError(error)}
          emptyTitle={l`Event not found`}
          emptyMessage={l`This event may have been deleted.`}
          onRetry={refetch}
        />
      </Layout.Screen>
    )
  }

  return (
    <Layout.Screen testID="eventRsvpsScreen">
      <EventRsvpsPager
        event={event}
        initialTab={tab === 'interested' ? 'interested' : 'going'}
      />
    </Layout.Screen>
  )
}

function Header({
  event,
  noBottomBorder,
}: {
  event?: EventRecord
  noBottomBorder?: boolean
}) {
  return (
    <Layout.Header.Outer noBottomBorder={noBottomBorder}>
      <Layout.Header.BackButton />
      <Layout.Header.Content>
        <Layout.Header.TitleText>
          <Trans>RSVPs</Trans>
        </Layout.Header.TitleText>
        {event && (
          <Layout.Header.SubtitleText>
            {event.value.name}
          </Layout.Header.SubtitleText>
        )}
      </Layout.Header.Content>
      <Layout.Header.Slot />
    </Layout.Header.Outer>
  )
}

function EventRsvpsPager({
  event,
  initialTab,
}: {
  event: EventRecord
  initialTab: EventRsvpsStatus
}) {
  const {t: l, i18n} = useLingui()
  const initialPage = TABS.indexOf(initialTab)
  const [activePage, setActivePage] = useState(initialPage)

  const formatCount = (count = 0) =>
    i18n.number(count, {notation: 'compact', maximumFractionDigits: 1})
  const tabLabels: Record<EventRsvpsStatus, string> = {
    interested: l({
      message: `Interested (${formatCount(event.rsvpsInterestedCount)})`,
      comment:
        'Tab listing the people interested in an event, followed by how many there are',
    }),
    going: l({
      message: `Going (${formatCount(event.rsvpsGoingCount)})`,
      comment:
        'Tab listing the people going to an event, followed by how many there are',
    }),
  }

  return (
    <Pager
      initialPage={initialPage}
      onPageSelected={setActivePage}
      renderTabBar={props => (
        <Layout.Center style={[a.z_10, web([a.sticky, {top: 0}])]}>
          <Header event={event} noBottomBorder />
          <TabBar items={TABS.map(status => tabLabels[status])} {...props} />
        </Layout.Center>
      )}>
      {TABS.map((status, i) => (
        <View key={status}>
          <EventRsvpsTab
            event={event}
            status={status}
            active={activePage === i}
          />
        </View>
      ))}
    </Pager>
  )
}

/** One tab's people: those the viewer follows first, then everyone else. */
function EventRsvpsTab({
  event,
  status,
  active,
}: {
  event: EventRecord
  status: EventRsvpsStatus
  active: boolean
}) {
  const {t: l} = useLingui()
  const initialNumToRender = useInitialNumToRender()
  const [isPTRing, setIsPTRing] = useState(false)
  const {
    data: friends,
    isLoading: isLoadingFriends,
    refetch: refetchFriends,
  } = useEventFriendRsvpsQuery({event})
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useEventRsvpsQuery({uri: event.uri, status, enabled: active})

  // Friends also appear in the full list, and people can hold several records.
  const seen = new Set<string>()
  const profiles = [
    ...(friends?.[status] ?? []),
    ...(data?.pages.flatMap(page => page.profiles) ?? []),
  ].filter(profile => {
    if (seen.has(profile.did)) return false
    seen.add(profile.did)
    return true
  })

  const onRefresh = async () => {
    setIsPTRing(true)
    await Promise.all([refetch(), refetchFriends()])
    setIsPTRing(false)
  }

  const onEndReached = () => {
    if (isFetchingNextPage || !hasNextPage || error) return
    void fetchNextPage()
  }

  if (profiles.length < 1) {
    return (
      <ListMaybePlaceholder
        isLoading={isLoadingFriends || isLoading || !data}
        isError={!!error}
        emptyType="results"
        emptyTitle={
          status === 'going'
            ? l`Nobody is going yet`
            : l`Nobody is interested yet`
        }
        emptyMessage={l`People who RSVP to this event will show up here.`}
        errorMessage={cleanError(error)}
        // Only offer the buttons on errors, not on an empty list.
        onRetry={error ? refetch : undefined}
        hideBackButton={!error}
        sideBorders={false}
        topBorder={false}
      />
    )
  }

  return (
    <List
      data={profiles}
      renderItem={({
        item,
        index,
      }: {
        item: app.bsky.actor.defs.ProfileViewDetailed
        index: number
      }) => <ProfileCardWithFollowBtn profile={item} noBorder={index === 0} />}
      keyExtractor={(item: app.bsky.actor.defs.ProfileViewDetailed) => item.did}
      refreshing={isPTRing}
      onRefresh={() => void onRefresh()}
      onEndReached={onEndReached}
      onEndReachedThreshold={4}
      ListFooterComponent={
        <ListFooter
          isFetchingNextPage={isFetchingNextPage}
          error={cleanError(error)}
          onRetry={fetchNextPage}
        />
      }
      desktopFixedHeight
      initialNumToRender={initialNumToRender}
      windowSize={11}
      sideBorders={false}
    />
  )
}
