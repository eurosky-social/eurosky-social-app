import {useEffect, useState} from 'react'
import {useAnimatedRef} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'
import {useIsFocused} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {listenSoftReset} from '#/state/events'
import {type FeedParams, RQKEY as FEED_RQKEY} from '#/state/queries/post-feed'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {truncateAndInvalidate} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {EmptyState} from '#/view/com/util/EmptyState'
import {FAB} from '#/view/com/util/fab/FAB'
import {type ListRef} from '#/view/com/util/List'
import {LoadLatestBtn} from '#/view/com/util/load-latest/LoadLatestBtn'
import {PostFeedLoadingPlaceholder} from '#/view/com/util/LoadingPlaceholder'
import {useLayoutBreakpoints, useTheme} from '#/alf'
import {EditBig_Stroke2_Corner2_Rounded as EditBigIcon} from '#/components/icons/EditBig'
import {HashtagWide_Stroke1_Corner0_Rounded as HashtagWideIcon} from '#/components/icons/Hashtag'
import * as Layout from '#/components/Layout'
import {IS_NATIVE, IS_WEB} from '#/env'
import {EventFeedTabs} from '#/features/events/components/EventFeedTabs'
import {OsoCollapsingHeader} from '#/features/osoNav/CollapsingHeader'
import {OsoTitlePill} from '#/features/osoNav/pills'
import {useMyFeedOptions} from './useMyFeedOptions'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoMyFeeds'>

/**
 * Oso's /myfeeds: one of the user's pinned feeds at a time, Following by
 * default. Laid out like the events page: the feed picker sits in the shell's
 * right column on wide screens (MyFeedsRightRail) and as tabs otherwise, and
 * the URL holds the selected feed so both can share it.
 */
export function OsoMyFeedsScreen({route, navigation}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {rightNavVisible} = useLayoutBreakpoints()
  const {hasSession} = useSession()
  const {openComposer} = useOpenComposer()
  const {options, resolveFeed, isLoading} = useMyFeedOptions()
  const {data: preferences} = usePreferencesQuery()
  const feed = resolveFeed(route.params?.feed)

  return (
    <Layout.Screen testID="osoMyFeedsScreen">
      {/* Slides away while scrolling down, as on the news page. */}
      <OsoCollapsingHeader
        header={
          <Layout.Header.Outer sticky={false}>
            <Layout.Header.BackButton />
            <Layout.Header.Content>
              <OsoTitlePill kind="feeds" />
            </Layout.Header.Content>
            <Layout.Header.Slot />
          </Layout.Header.Outer>
        }>
        {/* The shell's right column lists the feeds on wide screens. */}
        {!(IS_WEB && rightNavVisible) && options.length > 1 && (
          <Layout.Center>
            <EventFeedTabs
              items={options}
              selectedId={feed}
              onSelect={id => navigation.setParams({feed: id})}
            />
          </Layout.Center>
        )}
      </OsoCollapsingHeader>
      {isLoading || !preferences ? (
        <Layout.Content>
          <PostFeedLoadingPlaceholder />
        </Layout.Content>
      ) : (
        <SelectedFeed
          // Remount per feed so scroll position and polling start fresh.
          key={feed}
          feed={feed}
          feedParams={
            feed === 'following'
              ? {
                  mergeFeedEnabled: Boolean(
                    preferences.feedViewPrefs.lab_mergeFeedEnabled,
                  ),
                  mergeFeedSources: preferences.feedViewPrefs
                    .lab_mergeFeedEnabled
                    ? preferences.savedFeeds
                        .filter(f => f.type === 'feed' || f.type === 'list')
                        .map(f => f.value)
                    : [],
                }
              : undefined
          }
        />
      )}
      {hasSession && (
        <FAB
          testID="composeFAB"
          onPress={() => openComposer({logContext: 'Fab'})}
          icon={<EditBigIcon size="lg" fill={t.palette.white} />}
          accessibilityRole="button"
          accessibilityLabel={l`New post`}
          accessibilityHint=""
        />
      )}
    </Layout.Screen>
  )
}

function SelectedFeed({
  feed,
  feedParams,
}: {
  feed: ReturnType<ReturnType<typeof useMyFeedOptions>['resolveFeed']>
  feedParams?: FeedParams
}) {
  const {t: l} = useLingui()
  const queryClient = useQueryClient()
  const isScreenFocused = useIsFocused()
  const [hasNew, setHasNew] = useState(false)
  const [isScrolledDown, setIsScrolledDown] = useState(false)
  const scrollElRef = useAnimatedRef() as ListRef

  const onScrollToTop = () => {
    scrollElRef.current?.scrollToOffset({animated: IS_NATIVE, offset: 0})
    void truncateAndInvalidate(queryClient, FEED_RQKEY(feed, feedParams))
    setHasNew(false)
  }

  useEffect(() => {
    if (!isScreenFocused) return
    return listenSoftReset(onScrollToTop)
  })

  return (
    <>
      <PostFeed
        enabled
        feed={feed}
        feedParams={feedParams}
        pollInterval={60e3}
        disablePoll={hasNew}
        onHasNew={setHasNew}
        scrollElRef={scrollElRef}
        onScrolledDownChange={setIsScrolledDown}
        renderEmptyState={() => (
          <EmptyState
            icon={HashtagWideIcon}
            iconSize="2xl"
            message={l`This feed is empty.`}
          />
        )}
      />
      {(isScrolledDown || hasNew) && (
        <LoadLatestBtn
          onPress={onScrollToTop}
          label={l`Load new posts`}
          showIndicator={hasNew}
        />
      )}
    </>
  )
}
