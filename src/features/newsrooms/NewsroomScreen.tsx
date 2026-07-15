import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {useProfilesQuery} from '#/state/queries/profile'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {type ListMethods} from '#/view/com/util/List'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomsIcon} from '#/components/icons/Newspaper2'
import * as Layout from '#/components/Layout'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {NewsroomFrontPage} from './components/NewsroomFrontPage'
import {NewsroomMasthead} from './components/NewsroomMasthead'
import {NewsroomRightRail} from './components/NewsroomRightRail'
import {NewsroomSwitcher} from './components/NewsroomSwitcher'
import {
  getDefaultNewsroomPublisher,
  getNewsroomPublisherByDidOrHandle,
  getPublisherFeedDids,
  NEWSROOM_PUBLISHERS,
  type NewsroomPublisher,
} from './publishers'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Newsroom'>

export function NewsroomScreen({route, navigation}: Props) {
  const {name} = route.params

  // The URL is the single source of truth for the focused org, so navigating
  // here from anywhere (org switcher, profile shortcut, shared link) always
  // lands on the right publisher, including when the screen is already mounted.
  const publisher =
    (name && getNewsroomPublisherByDidOrHandle(name)) ||
    getDefaultNewsroomPublisher()

  const t = useTheme()
  const {t: l} = useLingui()
  const {rightNavVisible} = useLayoutBreakpoints()
  const scrollElRef = useRef<ListMethods>(null)

  // Org avatars for the switcher menu; shares the cache with the switcher rail.
  const {data: profiles} = useProfilesQuery({
    handles: NEWSROOM_PUBLISHERS.map(p => p.did),
  })
  const avatarByDid = new Map(
    profiles?.profiles.map(profile => [profile.did, profile.avatar]) ?? [],
  )

  function onSelectPublisher(next: NewsroomPublisher) {
    navigation.setParams({name: next.did})
    // The feed remounts keyed on the org; also reset the scroll position so
    // the new org's front page starts at the top.
    scrollElRef.current?.scrollToOffset({offset: 0, animated: false})
  }

  // Landing on the bare `/newsroom` (or an unknown org) carries no resolvable
  // name; reflect the focused org in the URL so it reads `/newsroom/<did>` and
  // is shareable.
  useEffect(() => {
    if (!name || !getNewsroomPublisherByDidOrHandle(name)) {
      navigation.setParams({name: publisher.did})
    }
  }, [name, publisher.did, navigation])

  // "The conversation" merges the publisher account and its reporters,
  // round-robin across their author feeds (see NewsFeedAPI).
  const feed =
    `newsroom|${getPublisherFeedDids(publisher).join(',')}` as FeedDescriptor

  return (
    <Layout.Screen testID="newsroomScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Mu Newsrooms</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {/* The org switcher scrolls away with the feed; this menu keeps
         * switching newsrooms one tap away from anywhere on the page. */}
        <Layout.Header.Slot>
          <Menu.Root>
            <Menu.Trigger label={l`Switch newsroom`}>
              {({props}) => (
                <Button
                  {...props}
                  testID="newsroomSwitcherMenuBtn"
                  label={l`Switch newsroom`}
                  size="small"
                  color="secondary"
                  shape="round">
                  <ButtonIcon icon={NewsroomsIcon} size="md" />
                </Button>
              )}
            </Menu.Trigger>
            <Menu.Outer>
              <Menu.Group>
                {NEWSROOM_PUBLISHERS.map(p => (
                  <Menu.Item
                    key={p.id}
                    label={l`Switch to ${p.displayName}`}
                    onPress={() => onSelectPublisher(p)}>
                    <UserAvatar
                      type="user"
                      size={20}
                      avatar={avatarByDid.get(p.did)}
                    />
                    <Menu.ItemText>{p.displayName}</Menu.ItemText>
                    <Menu.ItemRadio selected={p.id === publisher.id} />
                  </Menu.Item>
                ))}
              </Menu.Group>
            </Menu.Outer>
          </Menu.Root>
        </Layout.Header.Slot>
      </Layout.Header.Outer>

      {/* Primary nav: switch the focused org. Stays fixed above the feed,
       * constrained to the center column rather than the full viewport. */}
      <Layout.Center>
        <NewsroomSwitcher
          publishers={NEWSROOM_PUBLISHERS}
          selectedId={publisher.id}
          onSelect={onSelectPublisher}
        />
      </Layout.Center>

      <PostFeed
        // Key on the org so switching resets feed scroll/state cleanly.
        key={publisher.id}
        testID="newsroomFeed"
        scrollElRef={scrollElRef}
        feed={feed}
        renderEmptyState={renderEmpty}
        // An element rather than an inline component, so header state (image
        // loads, discussion) survives re-renders like follow-state changes.
        ListHeaderComponent={
          <>
            <NewsroomMasthead publisher={publisher} />
            {/* Editorial spine: the publisher's real published articles, with
             * the in-network discussion of the lead story woven in. */}
            <NewsroomFrontPage publisher={publisher} />
            {/* The shell's right column hosts the rail on wide screens; when it
             * is hidden, fall back to rendering it inline above the feed. */}
            {!rightNavVisible && (
              <View style={[a.pb_md]}>
                <NewsroomRightRail />
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
                <Trans>From {publisher.displayName} and its reporters</Trans>
              </Text>
            </View>
          </>
        }
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
