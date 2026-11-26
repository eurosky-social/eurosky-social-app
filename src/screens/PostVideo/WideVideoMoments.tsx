import {useState} from 'react'
import {
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {useIsFocused} from '@react-navigation/native'

import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {useSession} from '#/state/session'
import {useShellLayout} from '#/state/shell/shell-layout'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {SplitViewProvider} from '#/screens/Messages/components/splitView/context'
import {ReaderSeamControls} from '#/screens/PostThread/components/ReaderSeamControls'
import {ThreadItemAnchorFollowButton} from '#/screens/PostThread/components/ThreadItemAnchorFollowButton'
import {atoms as a, useLayoutBreakpoints, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {LockScroll} from '#/components/LockScroll'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {ComposerField} from '#/features/mediaTime/components/ComposerField'
import {MomentRoom} from '#/features/mediaTime/components/MomentRoom'
import {MomentsTimeline} from '#/features/mediaTime/components/MomentsTimeline'
import {MomentStrip} from '#/features/mediaTime/components/MomentStrip'
import {isMoment, type Moment, momentAt} from '#/features/mediaTime/moments'
import {
  getOwnVideoEmbed,
  getVideoTitle,
  parseMediaTimeParam,
} from '#/features/mediaTime/record'
import {useJumpToMediaTime} from '#/features/mediaTime/useJumpToMediaTime'
import {useMediaTimeParam} from '#/features/mediaTime/useMediaTimeParam'
import {usePauseAtMomentEnd} from '#/features/mediaTime/usePauseAtMomentEnd'
import {usePlaybackSecond} from '#/features/mediaTime/usePlaybackSecond'
import {useVideoMomentsWithStatus} from '#/features/mediaTime/useVideoMoments'
import {useVideoDuration} from '#/features/mediaTime/videoDuration'
import {playingMoment} from '#/features/mediaTime/watching'
import {
  ExploreColumn,
  ExploreSpreadBorders,
} from '#/features/news/explore/components/ExploreColumn'
import {type app} from '#/lexicons'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>
type PostView = app.bsky.feed.defs.PostView & {record: app.bsky.feed.post.Main}

/** The moments panel's width, as in the design canvas's web screen. */
const PANEL_WIDTH = 352
/** Room under the video for the strip, the title, the author and the buttons. */
const BELOW_VIDEO_HEIGHT = 330
/** The video stays at least this tall on short windows; the column scrolls. */
const MIN_VIDEO_HEIGHT = 280

/**
 * Whether the video's screens use the wide layout: on the web, once the
 * window is wide enough for the shell's right column, which these screens
 * take over (see `DesktopRightNav`).
 */
export function useWideVideoLayout() {
  const {rightNavVisible} = useLayoutBreakpoints()
  return IS_WEB && rightNavVisible
}

/**
 * A post's video with its moments on a wide web window (design canvas "mu on
 * the web"): the video, the strip of where people commented, its title and
 * author on the left; the moments in a panel on the right. Opening a moment
 * shows its comments in the panel, without leaving the page, and plays the
 * video from it. `openSeconds` opens the moment holding that second (the
 * moment's own address).
 */
export function WideVideoMoments({
  name,
  rkey,
  t: tParam,
  openSeconds,
}: {
  name: string
  rkey: string
  t?: string
  openSeconds?: number
}) {
  const t = useTheme()
  const isFocused = useIsFocused()
  // Signed out, the shell shows a bar along the bottom up to tablet width.
  const {footerHeight} = useShellLayout()
  const aboveBottomBar = useAnimatedStyle(() => ({
    paddingBottom: footerHeight.get(),
  }))
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const thread = usePostThread({anchor: uri})
  const anchor = thread.data.items.find(
    (item): item is ThreadPostItem =>
      item.type === 'threadPost' && item.depth === 0,
  )
  const post = anchor?.value.post
  const video = post ? getOwnVideoEmbed(post.embed) : undefined
  // `uri` may name the account by its handle; moments and players use the
  // post's own URI, which names it by its DID.
  const postUri = post?.uri ?? uri
  // the video picks the jump up once its player mounts
  useMediaTimeParam({postUri, name, rkey, t: post ? tParam : undefined})

  return (
    <Layout.Screen testID="postVideoWideScreen" noCenterBorders>
      {isFocused ? <LockScroll /> : null}
      <ExploreSpreadBorders />
      <ExploreColumn style={{height: '100vh' as const}}>
        <Animated.View style={[a.flex_1, a.flex_row, aboveBottomBar]}>
          {anchor && post && video ? (
            <Loaded
              item={anchor}
              post={post}
              video={video}
              startSeconds={parseMediaTimeParam(tParam) ?? openSeconds ?? 0}
              openSeconds={openSeconds}
              threadItems={thread.data.items}
              threadgateRecord={thread.data.threadgate?.record}
            />
          ) : (
            <View style={[a.flex_1, a.px_xl]}>
              <BackRow />
              {thread.state.isFetching ? (
                <View style={[a.py_2xl, a.align_center]}>
                  <ActivityIndicator />
                </View>
              ) : (
                <Text
                  style={[
                    a.py_2xl,
                    a.text_md,
                    a.text_center,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>This video is not available.</Trans>
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </ExploreColumn>
    </Layout.Screen>
  )
}

function Loaded({
  item,
  post,
  video,
  startSeconds,
  openSeconds,
  threadItems,
  threadgateRecord,
}: {
  item: ThreadPostItem
  post: PostView
  video: app.bsky.embed.video.View
  startSeconds: number
  openSeconds?: number
  threadItems: ThreadItem[]
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {height} = useWindowDimensions()
  const jump = useJumpToMediaTime()
  const playing = usePlaybackSecond(post.uri)
  const duration = useVideoDuration({
    postUri: post.uri,
    playlist: video.playlist,
  })
  const {moments, loading} = useVideoMomentsWithStatus({
    videoPostUri: post.uri,
    threadItems,
  })
  // The open moment is kept by the second it was opened at: moments move a
  // little as comments come in.
  const [roomSeconds, setRoomSeconds] = useState(openSeconds)
  const room =
    roomSeconds !== undefined ? momentAt(moments, roomSeconds) : undefined
  usePauseAtMomentEnd(post.uri, room)
  const now = playingMoment(moments, playing)

  const openRoom = (moment: Moment) => {
    setRoomSeconds(moment.startSeconds)
    jump(post.uri, moment.startSeconds)
  }
  const onPressSecond = (pressed: number) => {
    const target = momentAt(moments, pressed)
    if (roomSeconds !== undefined && target) {
      // With a moment open, the strip switches to the moment tapped.
      openRoom(target)
    } else {
      jump(post.uri, pressed)
    }
  }

  // The player's box is at most square on the web (`ConstrainedImage`), so
  // its height follows from its width; keep it within the window.
  const boxRatio = video.aspectRatio
    ? Math.max(video.aspectRatio.width / video.aspectRatio.height, 1)
    : 1
  const maxVideoHeight = Math.max(MIN_VIDEO_HEIGHT, height - BELOW_VIDEO_HEIGHT)
  const title = getVideoTitle(post.record.text)

  return (
    <>
      <ScrollView
        style={[a.flex_1]}
        contentContainerStyle={[a.px_xl, a.pb_2xl]}>
        <BackRow />
        <ContentHider modui={item.moderation.ui('contentView')} ignoreMute>
          <View
            style={[
              a.w_full,
              a.self_center,
              {maxWidth: maxVideoHeight * boxRatio},
            ]}>
            <Embed
              embed={post.embed}
              moderation={item.moderation}
              viewContext={PostEmbedViewContext.ThreadHighlighted}
              post={post}
            />
          </View>
          <View style={[a.pt_md]}>
            <MomentStrip
              moments={moments}
              current={room ?? now}
              duration={duration}
              playing={playing}
              onPressSecond={onPressSecond}
            />
          </View>
        </ContentHider>
        {title ? (
          <Text
            emoji
            style={[a.pt_lg, a.text_2xl, a.font_bold, a.leading_snug]}
            numberOfLines={3}>
            {title}
          </Text>
        ) : null}
        <AuthorRow post={post} moderation={item.moderation} />
        <ReaderSeamControls
          post={item}
          threadgateRecord={threadgateRecord}
          showDetails={false}
        />
      </ScrollView>
      <SplitViewProvider side="right">
        <View
          testID="videoMomentsPanel"
          style={[
            a.flex_shrink_0,
            a.border_l,
            t.atoms.border_contrast_low,
            {width: PANEL_WIDTH},
          ]}>
          {roomSeconds !== undefined ? (
            <MomentRoom
              layout="panel"
              videoPost={post}
              videoModeration={item.moderation}
              threadgateRecord={threadgateRecord}
              moment={room}
              moments={moments}
              seconds={roomSeconds}
              loading={loading}
              onBack={() => setRoomSeconds(undefined)}
            />
          ) : (
            <>
              <View style={[a.flex_1]}>
                <MomentsTimeline
                  moments={moments}
                  loading={loading}
                  playing={playing}
                  threadgateRecord={threadgateRecord}
                  canFollow
                  onOpenMoment={openRoom}
                  onPlaySecond={seconds => jump(post.uri, seconds)}
                />
              </View>
              <View
                style={[
                  a.px_lg,
                  a.py_md,
                  a.border_t,
                  t.atoms.border_contrast_low,
                ]}>
                <ComposerField
                  videoPost={post}
                  videoModeration={item.moderation}
                  fallbackSeconds={startSeconds}
                  placeholder={
                    moments.some(isMoment)
                      ? l`Add a comment…`
                      : l`Be one of the first…`
                  }
                />
              </View>
            </>
          )}
        </View>
      </SplitViewProvider>
    </>
  )
}

function BackRow() {
  return (
    <View style={[a.flex_row, a.align_center, {height: 52}]}>
      <Layout.Header.BackButton />
    </View>
  )
}

/** Who posted the video, when, and a follow button. */
function AuthorRow({
  post,
  moderation,
}: {
  post: PostView
  moderation: ModerationDecision
}) {
  const t = useTheme()
  const {currentAccount} = useSession()
  const author = post.author
  const authorName = sanitizeDisplayName(
    author.displayName || sanitizeHandle(author.handle),
    moderation.ui('displayName'),
  )
  return (
    <View style={[a.flex_row, a.align_center, a.gap_md, a.pt_md, a.pb_sm]}>
      <PreviewableUserAvatar
        size={40}
        profile={author}
        moderation={moderation.ui('avatar')}
        type={author.associated?.labeler ? 'labeler' : 'user'}
      />
      <Link to={makeProfileLink(author)} label={authorName} style={[a.flex_1]}>
        <View style={[a.flex_1]}>
          <Text
            emoji
            style={[a.text_md, a.font_bold, a.leading_snug]}
            numberOfLines={1}>
            {authorName}
          </Text>
          <TimeElapsed timestamp={post.indexedAt}>
            {({timeElapsed}) => (
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}
                numberOfLines={1}>
                {`${sanitizeHandle(author.handle, '@')} · ${timeElapsed}`}
              </Text>
            )}
          </TimeElapsed>
        </View>
      </Link>
      <ThreadItemAnchorFollowButton
        did={author.did}
        enabled={currentAccount?.did !== author.did}
      />
    </View>
  )
}
