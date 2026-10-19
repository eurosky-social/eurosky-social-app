import {View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useResolveUriQuery} from '#/state/queries/resolve-uri'
import {useSession} from '#/state/session'
import {Post} from '#/view/com/post/Post'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as Layout from '#/components/Layout'
import {ListFooter, ListMaybePlaceholder} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {EventsApiError} from './api'
import {CreateOrEditEventDialog} from './components/CreateOrEditEventDialog'
import {EventComposerPrompt} from './components/EventComposerPrompt'
import {EventDetails} from './components/EventDetails'
import {EVENT_NSID, EVENT_POSTS_PAGE_SIZE} from './config'
import {useEventPostsQuery, useEventQuery} from './queries'
import {type EventProfile, type EventRecord} from './types'
import {getEventShareUrls, hideEventLinks} from './util'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Event'>

/**
 * A single event with every post about it, laid out like a post thread: the
 * event is the first row of the list and the posts follow.
 */
export function EventScreen({route}: Props) {
  const {name, rkey} = route.params
  const {t: l} = useLingui()
  const {data: resolved, error: resolveError} = useResolveUriQuery(
    AtUri.make(name, EVENT_NSID, rkey).toString(),
  )
  const {
    data: event,
    error: eventError,
    refetch: refetchEvent,
  } = useEventQuery({uri: resolved?.uri})
  const notFound =
    eventError instanceof EventsApiError && eventError.status === 404
  const error = resolveError ?? (notFound ? null : eventError)

  return (
    <Layout.Screen testID="eventScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Event</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {event ? (
        <EventPostsList
          event={event}
          profile={event.profiles?.find(p => p.did === event.did)}
          onRefreshEvent={refetchEvent}
        />
      ) : (
        <ListMaybePlaceholder
          isLoading={!error && !notFound}
          isError={!!error}
          errorMessage={cleanError(error)}
          emptyTitle={l`Event not found`}
          emptyMessage={l`This event may have been deleted.`}
          onRetry={refetchEvent}
        />
      )}
    </Layout.Screen>
  )
}

function EventPostsList({
  event,
  profile,
  onRefreshEvent,
}: {
  event: EventRecord
  profile?: EventProfile
  onRefreshEvent: () => Promise<unknown>
}) {
  const t = useTheme()
  const {hasSession} = useSession()
  const editControl = Dialog.useDialogControl()
  const {
    data,
    error,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEventPostsQuery({event, profile, pageSize: EVENT_POSTS_PAGE_SIZE})

  const posts = data?.pages.flatMap(page => page.posts) ?? []
  const eventUrls = getEventShareUrls(event, profile)

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !error) void fetchNextPage()
  }

  return (
    <>
      <List
        data={posts}
        keyExtractor={(post: app.bsky.feed.defs.PostView) => post.uri}
        renderItem={({item}: {item: app.bsky.feed.defs.PostView}) => (
          <Post post={hideEventLinks(item, eventUrls)} />
        )}
        refreshing={isRefetching}
        onRefresh={() => void Promise.all([onRefreshEvent(), refetch()])}
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        ListHeaderComponent={
          <>
            <EventDetails
              event={event}
              profile={profile}
              onEdit={() => editControl.open()}
            />
            <View
              style={[
                a.px_xl,
                a.py_md,
                a.border_t,
                t.atoms.border_contrast_low,
              ]}>
              <Text style={[a.text_md, a.font_semi_bold]}>
                <Trans>Posts about this event</Trans>
              </Text>
            </View>
            <EventComposerPrompt event={event} profile={profile} />
          </>
        }
        ListEmptyComponent={
          !hasSession ? (
            <EmptyMessageText>
              <Trans>Sign in to see posts about this event.</Trans>
            </EmptyMessageText>
          ) : isLoading || error ? undefined : (
            <EmptyMessageText>
              <Trans>No one has posted about this event yet.</Trans>
            </EmptyMessageText>
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
      {hasSession && (
        <CreateOrEditEventDialog control={editControl} event={event} />
      )}
    </>
  )
}

function EmptyMessageText({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text style={[a.px_xl, a.pb_xl, a.text_md, t.atoms.text_contrast_medium]}>
      {children}
    </Text>
  )
}
