import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {CuratedFrontPage} from './components/CuratedFrontPage'
import {CuratedOrgSwitcher} from './components/CuratedOrgSwitcher'
import {CuratedPageMasthead} from './components/CuratedPageMasthead'
import {CuratedRightRail} from './components/CuratedRightRail'
import {
  CURATED_PUBLISHERS,
  type CuratedPublisher,
  getCuratedPublisherByDidOrHandle,
  getDefaultCuratedPublisher,
} from './publishers'
import {
  useCuratedPagesPrefsQuery,
  useToggleCuratedSubscription,
} from './state/prefs'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'CuratedPage'>

export function CuratedPageScreen({route, navigation}: Props) {
  const {name} = route.params

  // The org in focus is local state for instant switching; the URL follows
  // along (shareable `/newsroom/:didOrHandle`) without remounting the screen.
  const initial = (name && getCuratedPublisherByDidOrHandle(name)) || undefined
  const [selectedId, setSelectedId] = useState(
    (initial ?? getDefaultCuratedPublisher()).id,
  )
  const publisher =
    CURATED_PUBLISHERS.find(p => p.id === selectedId) ??
    getDefaultCuratedPublisher()

  const t = useTheme()
  const {data: prefs} = useCuratedPagesPrefsQuery()
  const toggleSubscription = useToggleCuratedSubscription()
  const {rightNavVisible} = useLayoutBreakpoints()

  function onSelectPublisher(next: CuratedPublisher) {
    setSelectedId(next.id)
    navigation.setParams({name: next.did})
  }

  // Landing on the bare `/newsroom` carries no name; reflect the focused org in
  // the URL so it reads `/newsroom/<did>` and is shareable.
  useEffect(() => {
    if (!name) {
      navigation.setParams({name: publisher.did})
    }
  }, [name, publisher.did, navigation])

  const isSubscribed =
    prefs?.subscribedPublisherIds.includes(publisher.id) ?? false
  // "The conversation" is the publisher's own profile feed (its posts and
  // author threads), the same view their Bluesky profile shows.
  const feed =
    `author|${publisher.did}|posts_and_author_threads` as FeedDescriptor

  return (
    <Layout.Screen testID="curatedPageScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Mu Newsrooms</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      {/* Primary nav: switch the focused org. Stays fixed above the feed,
       * constrained to the center column rather than the full viewport. */}
      <Layout.Center>
        <CuratedOrgSwitcher
          publishers={CURATED_PUBLISHERS}
          selectedId={publisher.id}
          onSelect={onSelectPublisher}
        />
      </Layout.Center>

      <PostFeed
        // Key on the org so switching resets feed scroll/state cleanly.
        key={publisher.id}
        testID="curatedPageFeed"
        feed={feed}
        renderEmptyState={renderEmpty}
        ListHeaderComponent={() => (
          <>
            <CuratedPageMasthead
              publisher={publisher}
              isSubscribed={isSubscribed}
              onToggleSubscribe={() => void toggleSubscription(publisher.id)}
            />
            {/* Editorial spine: the publisher's real published articles, with
             * the in-network discussion of the lead story woven in. */}
            <CuratedFrontPage publisher={publisher} />
            {/* The shell's right column hosts the rail on wide screens; when it
             * is hidden, fall back to rendering it inline above the feed. */}
            {!rightNavVisible && (
              <View style={[a.pb_md]}>
                <CuratedRightRail />
              </View>
            )}
            {/* Native social layer: the conversation around the journalism. */}
            <View
              style={[
                a.px_lg,
                a.pt_lg,
                a.pb_sm,
                a.border_t,
                t.atoms.border_contrast_low,
              ]}>
              <Text
                emoji
                style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
                <Trans>From {publisher.displayName}</Trans>
              </Text>
            </View>
          </>
        )}
      />
    </Layout.Screen>
  )
}

function renderEmpty() {
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.p_2xl]}>
      <Text style={[a.text_md, a.text_center]}>
        <Trans>No recent posts from this publisher.</Trans>
      </Text>
    </View>
  )
}
