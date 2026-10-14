import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
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
import {BRAND} from '#/config/brand'
import {NewsroomFrontPage} from './components/NewsroomFrontPage'
import {NewsroomMasthead} from './components/NewsroomMasthead'
import {NewsroomRightRail} from './components/NewsroomRightRail'
import {findNewsroom, useNewsroomReporters, useNewsrooms} from './newsrooms'
import {getPublisherName} from './publishers'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Newsroom'>

/**
 * A newsroom: one of the news aggregator's outlets, with its masthead, its
 * latest articles, and - where it has a Bluesky account - the conversation
 * from it and its reporters.
 */
export function NewsroomScreen({route, navigation}: Props) {
  const {name} = route.params

  /*
   * The URL is the single source of truth for the newsroom, so navigating
   * here from anywhere (a byline, a link chip, a profile shortcut, a shared
   * link) lands on the right one, even when the screen is already mounted.
   * It names the outlet by slug or by its account's DID; a handle resolves
   * to its DID through the live profile first.
   */
  const {newsrooms, isLoading} = useNewsrooms()
  const direct = findNewsroom(newsrooms, name)
  const lookUpHandle =
    !!name && !!newsrooms && !direct && !name.startsWith('did:')
  const {data: namedProfile, isLoading: isResolvingName} = useProfileQuery({
    did: lookUpHandle ? name : undefined,
  })
  const newsroom =
    direct ??
    (namedProfile ? findNewsroom(newsrooms, namedProfile.did) : undefined)
  const resolving = isLoading || (lookUpHandle && isResolvingName)

  const t = useTheme()
  const {t: l} = useLingui()
  const {rightNavVisible} = useLayoutBreakpoints()
  const scrollElRef = useRef<ListMethods>(null)

  const {data: profile} = useProfileQuery({did: newsroom?.did})
  /*
   * The conversation merges the outlet's account and its reporters', round-
   * robin across their author feeds (see NewsFeedAPI). Held back until a
   * verifying outlet's journalists are known, so the feed starts once.
   */
  const {conversationDids, isLoading: reportersLoading} =
    useNewsroomReporters(newsroom)
  const newsroomName = getPublisherName(profile) || newsroom?.name || ''

  /* The address settles on the slug, whatever named the newsroom. */
  useEffect(() => {
    if (newsroom && name !== newsroom.slug) {
      navigation.setParams({name: newsroom.slug})
    }
  }, [name, newsroom, navigation])

  /* Without a newsroom to show, the directory lists them all. */
  useEffect(() => {
    if (!name) navigation.replace('NewsroomDirectory')
  }, [name, navigation])

  if (resolving || !name) {
    return (
      <Layout.Screen testID="newsroomScreen">
        <Layout.Center style={[a.flex_1, a.justify_center, a.align_center]}>
          <Loader size="xl" />
        </Layout.Center>
      </Layout.Screen>
    )
  }

  if (!newsroom) {
    return (
      <Layout.Screen testID="newsroomScreen">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>{BRAND.name} News</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <Layout.Center style={[a.flex_1, a.align_center, a.gap_lg, a.p_2xl]}>
          <Text style={[a.text_md, a.text_center]}>
            <Trans>There is no newsroom here.</Trans>
          </Text>
          <Link
            to="/newsrooms"
            label={l`See every newsroom`}
            size="small"
            color="secondary">
            <ButtonIcon icon={NewsroomsIcon} />
            <ButtonText>
              <Trans>All newsrooms</Trans>
            </ButtonText>
          </Link>
        </Layout.Center>
      </Layout.Screen>
    )
  }

  const feedDids = reportersLoading ? [] : conversationDids
  /* The journalism, then the rail inline where the shell has no column for it. */
  const front = (
    <>
      <NewsroomMasthead newsroom={newsroom} />
      <NewsroomFrontPage newsroom={newsroom} />
      {/* The shell's right column hosts the rail on wide screens; when it
       * is hidden, fall back to rendering it inline above the feed. */}
      {!rightNavVisible && (
        <View style={[a.pb_md]}>
          <NewsroomRightRail inline />
        </View>
      )}
    </>
  )

  return (
    <Layout.Screen testID="newsroomScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>{BRAND.name} News</Trans>
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

      {feedDids.length === 0 ? (
        /* An outlet with no accounts at all has no conversation to follow. */
        <Layout.Content key={newsroom.slug}>{front}</Layout.Content>
      ) : (
        <PostFeed
          // Key on the newsroom so switching resets feed scroll/state cleanly.
          key={newsroom.slug}
          testID="newsroomFeed"
          scrollElRef={scrollElRef}
          /*
           * The conversation merges the outlet's account and its reporters',
           * round-robin across their author feeds (see NewsFeedAPI).
           */
          feed={`newsroom|${feedDids.join(',')}`}
          renderEmptyState={renderEmpty}
          // An element rather than an inline component, so header state (image
          // loads, discussion) survives re-renders like follow-state changes.
          ListHeaderComponent={
            <>
              {front}
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
                  style={{color: newsroom.accent ?? t.palette.primary_500}}
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
                  <Trans>From {newsroomName} and its reporters</Trans>
                </Text>
              </View>
            </>
          }
        />
      )}
    </Layout.Screen>
  )
}

function renderEmpty() {
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.p_2xl]}>
      <Text style={[a.text_md, a.text_center]}>
        <Trans>No recent posts from this newsroom.</Trans>
      </Text>
    </View>
  )
}
