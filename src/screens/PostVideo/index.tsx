import {useRef} from 'react'
import {ActivityIndicator, useWindowDimensions, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {type VideoPlayer} from 'expo-video'
import {useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {atoms as a, ThemeProvider, useTheme} from '#/alf'
import {KeepAwake} from '#/components/KeepAwake'
import * as Layout from '#/components/Layout'
import {ContentHider} from '#/components/moderation/ContentHider'
import {ComposerField} from '#/features/mediaTime/components/ComposerField'
import {MomentsTimeline} from '#/features/mediaTime/components/MomentsTimeline'
import {MomentStrip} from '#/features/mediaTime/components/MomentStrip'
import {VideoTitleBlock} from '#/features/mediaTime/components/VideoTitleBlock'
import {isMoment} from '#/features/mediaTime/moments'
import {openMoment} from '#/features/mediaTime/openMoment'
import {
  getOwnVideoEmbed,
  parseMediaTimeParam,
} from '#/features/mediaTime/record'
import {useJumpToMediaTime} from '#/features/mediaTime/useJumpToMediaTime'
import {
  usePlaybackDuration,
  usePlaybackSecond,
} from '#/features/mediaTime/usePlaybackSecond'
import {useVideoMomentsWithStatus} from '#/features/mediaTime/useVideoMoments'
import {playingMoment} from '#/features/mediaTime/watching'
import {type app} from '#/lexicons'
import {
  Unavailable,
  useVideoScreenChrome,
  VideoHeaderBar,
  VideoSurface,
} from './VideoSurface'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>

/** The video takes at most this share of the screen's height. */
const MAX_VIDEO_HEIGHT_SHARE = 0.4

/**
 * A post's video with its moments (iOS and Android; design canvas
 * "Watching, with moments"), playing from second `t`: the video, where
 * people commented along it, and the moments as a timeline that follows
 * playback. Opened by time links and by "All moments".
 */
export function PostVideoScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostVideo'>) {
  const {name, rkey, t: tParam} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const startSeconds = parseMediaTimeParam(tParam) ?? 0
  useVideoScreenChrome()
  const {top} = useSafeAreaInsets()

  const thread = usePostThread({anchor: uri})
  const anchor = thread.data.items.find(
    (item): item is ThreadPostItem =>
      item.type === 'threadPost' && item.depth === 0,
  )
  const video = anchor ? getOwnVideoEmbed(anchor.value.post.embed) : undefined
  const authorName = anchor
    ? sanitizeDisplayName(
        anchor.value.post.author.displayName || anchor.value.post.author.handle,
        anchor.moderation.ui('displayName'),
      )
    : undefined

  return (
    <ThemeProvider theme="dark">
      <Layout.Screen
        testID="postVideoScreen"
        minimalShell
        fullBleed
        noInsetTop
        style={{backgroundColor: 'black'}}>
        <KeepAwake />
        <View style={{paddingTop: top}}>
          <VideoHeaderBar title={authorName} />
        </View>
        {anchor && video ? (
          <Player
            item={anchor}
            video={video}
            startSeconds={startSeconds}
            threadItems={thread.data.items}
            threadgateRecord={thread.data.threadgate?.record}
          />
        ) : thread.state.isFetching ? (
          <View style={[a.flex_1, a.align_center, a.justify_center]}>
            <ActivityIndicator size="large" color="white" />
          </View>
        ) : (
          <Unavailable />
        )}
      </Layout.Screen>
    </ThemeProvider>
  )
}

function Player({
  item,
  video,
  startSeconds,
  threadItems,
  threadgateRecord,
}: {
  item: ThreadPostItem
  video: app.bsky.embed.video.View
  startSeconds: number
  threadItems: ThreadItem[]
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const post = item.value.post
  const t = useTheme()
  const {t: l} = useLingui()
  const {bottom} = useSafeAreaInsets()
  const {width, height} = useWindowDimensions()
  const jump = useJumpToMediaTime()
  const playerRef = useRef<VideoPlayer | null>(null)
  const playing = usePlaybackSecond(post.uri)
  const duration = usePlaybackDuration(post.uri)
  const {moments, loading} = useVideoMomentsWithStatus({
    videoPostUri: post.uri,
    threadItems,
  })
  const now = playingMoment(moments, playing)
  const ratio = video.aspectRatio
    ? video.aspectRatio.width / video.aspectRatio.height
    : 16 / 9
  const videoHeight = Math.min(width / ratio, height * MAX_VIDEO_HEIGHT_SHARE)

  return (
    <ContentHider
      modui={item.moderation.ui('contentView')}
      ignoreMute
      style={[a.flex_1]}
      childContainerStyle={[a.flex_1]}>
      <VideoSurface
        postUri={post.uri}
        video={video}
        moderation={item.moderation}
        startSeconds={startSeconds}
        style={{height: videoHeight}}
        playerRef={playerRef}
      />
      <View style={[a.px_lg, a.pt_md]}>
        <MomentStrip
          moments={moments}
          current={now}
          duration={duration}
          playing={playing}
          onPressSecond={seconds => jump(post.uri, seconds)}
        />
      </View>
      <View style={[a.flex_1]}>
        <MomentsTimeline
          moments={moments}
          loading={loading}
          playing={playing}
          threadgateRecord={threadgateRecord}
          header={
            <VideoTitleBlock
              post={post}
              moderation={item.moderation}
              moments={moments}
            />
          }
          onOpenMoment={moment => openMoment(post.uri, moment.startSeconds)}
          onPlaySecond={seconds => jump(post.uri, seconds)}
        />
      </View>
      <View
        style={[
          a.px_lg,
          a.pt_sm,
          a.border_t,
          t.atoms.border_contrast_low,
          {paddingBottom: bottom + 12},
        ]}>
        <ComposerField
          videoPost={post}
          videoModeration={item.moderation}
          fallbackSeconds={startSeconds}
          placeholder={
            moments.some(isMoment) ? l`Add a comment…` : l`Be one of the first…`
          }
          onBeforeCompose={() => playerRef.current?.pause()}
        />
      </View>
    </ContentHider>
  )
}
