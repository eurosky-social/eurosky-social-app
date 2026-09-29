import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {useProfileQuery} from '#/state/queries/profile'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {type ListMethods} from '#/view/com/util/List'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Newspaper_Stroke2_Corner2_Rounded as NewsFeedIcon} from '#/components/icons/Newspaper'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomsIcon} from '#/components/icons/Newspaper2'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {NewsroomFrontPage} from './components/NewsroomFrontPage'
import {NewsroomMasthead} from './components/NewsroomMasthead'
import {NewsroomRightRail} from './components/NewsroomRightRail'
import {
  getDefaultNewsroomPublisher,
  getNewsroomPublisherByDid,
  getPublisherFeedDids,
  getPublisherName,
} from './publishers'
import {useNewsroomProfilesQuery} from './queries'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Newsroom'>

export function NewsroomScreen({route, navigation}: Props) {
  const {name} = route.params

  // The URL is the single source of truth for the focused org, so navigating
  // here from anywhere (org switcher, profile shortcut, shared link) always
  // lands on the right publisher, including when the screen is already mounted.
  // A DID param matches the registry directly; a handle param resolves through
  // the live profile first (getProfile accepts any actor identifier).
  const direct = name ? getNewsroomPublisherByDid(name) : undefined
  const {data: namedProfile, isLoading: isResolvingName} = useProfileQuery({
    did: direct ? undefined : name,
  })
  const resolved = namedProfile
    ? getNewsroomPublisherByDid(namedProfile.did)
    : undefined
  const publisher = direct ?? resolved ?? getDefaultNewsroomPublisher()
  const resolvingName = !direct && !!name && isResolvingName

  const t = useTheme()
  const {t: l} = useLingui()
  const {rightNavVisible} = useLayoutBreakpoints()
  const scrollElRef = useRef<ListMethods>(null)

  const profiles = useNewsroomProfilesQuery()
  const publisherName = getPublisherName(profiles.get(publisher.did))

  // Normalize the URL to the focused org's DID (`/newsroom/<did>`), waiting
  // out an in-flight handle resolution so a handle deep link is not clobbered
  // with the default org.
  useEffect(() => {
    if (resolvingName) return
    if (name !== publisher.did) {
      navigation.setParams({name: publisher.did})
    }
  }, [resolvingName, name, publisher.did, navigation])

  // "The conversation" merges the publisher account and its reporters,
  // round-robin across their author feeds (see NewsFeedAPI).
  const feed =
    `newsroom|${getPublisherFeedDids(publisher).join(',')}` as FeedDescriptor

  if (resolvingName) {
    return (
      <Layout.Screen testID="newsroomScreen">
        <Layout.Center style={[a.flex_1, a.justify_center, a.align_center]}>
          <Loader size="xl" />
        </Layout.Center>
      </Layout.Screen>
    )
  }

  return (
    <Layout.Screen testID="newsroomScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Mu News</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {/* Mirrors the news feed header's "Newsrooms" link, so the two news
         * surfaces cross-link both ways. Sits outside Header.Slot: slots are
         * fixed-width squares and this button carries a text label. */}
        <Link
          testID="newsroomNewsFeedBtn"
          to="/news"
          label={l`Open your news feed`}
          size="small"
          color="secondary">
          <ButtonIcon icon={NewsFeedIcon} />
          <ButtonText>
            <Trans>News</Trans>
          </ButtonText>
        </Link>
      </Layout.Header.Outer>

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
                <NewsroomRightRail inline />
              </View>
            )}
            {/* Native social layer: the conversation around the journalism. */}
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.px_lg,
                a.py_xl,
                a.border_t,
                a.border_b,
                t.atoms.border_contrast_low,
              ]}>
              <NewsroomsIcon
                size="lg"
                style={{color: publisher.accent ?? t.palette.primary_500}}
              />
              <Text
                emoji
                style={[
                  a.flex_1,
                  a.text_2xl,
                  a.font_bold,
                  a.leading_tight,
                  t.atoms.text,
                ]}>
                <Trans>From {publisherName} and its reporters</Trans>
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
