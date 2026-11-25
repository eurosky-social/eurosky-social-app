import {useRef} from 'react'
import {ActivityIndicator, useWindowDimensions, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {type VideoPlayer} from 'expo-video'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {getHomeNavigationAction} from '#/lib/routes/navigation'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {
  Unavailable,
  useVideoScreenChrome,
  VideoSurface,
} from '#/screens/PostVideo/VideoSurface'
import {atoms as a, ThemeProvider} from '#/alf'
import {useThemeName} from '#/alf/util/useColorModeTheme'
import {Button, ButtonIcon} from '#/components/Button'
import {ChevronLeft_Stroke2_Corner0_Rounded as BackIcon} from '#/components/icons/Chevron'
import {KeepAwake} from '#/components/KeepAwake'
import * as Layout from '#/components/Layout'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {MomentRoom} from '#/features/mediaTime/components/MomentRoom'
import {MomentStrip} from '#/features/mediaTime/components/MomentStrip'
import {momentAt} from '#/features/mediaTime/moments'
import {
  getOwnVideoEmbed,
  getVideoTitle,
  parseMediaTimeParam,
} from '#/features/mediaTime/record'
import {useJumpToMediaTime} from '#/features/mediaTime/useJumpToMediaTime'
import {
  usePlaybackDuration,
  usePlaybackSecond,
} from '#/features/mediaTime/usePlaybackSecond'
import {useVideoMomentsWithStatus} from '#/features/mediaTime/useVideoMoments'
import {type app} from '#/lexicons'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>

/** The video takes at most this share of the screen's height. */
const MAX_VIDEO_HEIGHT_SHARE = 0.4

/**
 * One moment of a post's video and its comments (iOS and Android): a dark
 * header and the video, playing from second `t`, and below it the moment
 * holding that second, as a sheet in the app's own theme.
 */
export function PostMomentScreen({
  route,
  navigation,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostMoment'>) {
  const {name, rkey, t: tParam} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const seconds = parseMediaTimeParam(tParam) ?? 0
  useVideoScreenChrome()
  const {top} = useSafeAreaInsets()

  const thread = usePostThread({anchor: uri})
  const anchor = thread.data.items.find(
    (item): item is ThreadPostItem =>
      item.type === 'threadPost' && item.depth === 0,
  )
  const video = anchor ? getOwnVideoEmbed(anchor.value.post.embed) : undefined
  const title = anchor
    ? (getVideoTitle(anchor.value.post.record.text) ??
      sanitizeDisplayName(
        anchor.value.post.author.displayName || anchor.value.post.author.handle,
        anchor.moderation.ui('displayName'),
      ))
    : undefined

  return (
    <ThemeProvider theme="dark">
      <Layout.Screen
        testID="postMomentScreen"
        minimalShell
        fullBleed
        noInsetTop
        style={{backgroundColor: 'black'}}>
        <KeepAwake />
        <View style={{paddingTop: top}}>
          <HeaderBar title={title} />
        </View>
        {anchor && video ? (
          <MomentWithVideo
            item={anchor}
            video={video}
            seconds={seconds}
            threadItems={thread.data.items}
            threadgateRecord={thread.data.threadgate?.record}
            onSelectSeconds={next => navigation.setParams({t: String(next)})}
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

function useGoBack() {
  const navigation = useNavigation<NavigationProp>()
  return () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.dispatch(
        getHomeNavigationAction(navigation.getState(), 'navigate'),
      )
    }
  }
}

function HeaderBar({title}: {title: string | undefined}) {
  const {t: l} = useLingui()
  const goBack = useGoBack()
  return (
    <View style={[a.flex_row, a.align_center, a.px_xs, {height: 48}]}>
      <Button
        testID="postMomentBack"
        label={l`Go back`}
        size="large"
        variant="ghost"
        color="secondary"
        shape="round"
        onPress={goBack}>
        <ButtonIcon icon={BackIcon} size="lg" />
      </Button>
      <Text
        emoji
        style={[a.flex_1, a.text_center, a.text_sm, a.font_semi_bold]}
        numberOfLines={1}>
        {title}
      </Text>
      <View style={{width: 44}} />
    </View>
  )
}

function MomentWithVideo({
  item,
  video,
  seconds,
  threadItems,
  threadgateRecord,
  onSelectSeconds,
}: {
  item: ThreadPostItem
  video: app.bsky.embed.video.View
  seconds: number
  threadItems: ThreadItem[]
  threadgateRecord?: app.bsky.feed.threadgate.Main
  /** Shows the moment holding another second. */
  onSelectSeconds: (seconds: number) => void
}) {
  const post = item.value.post
  const jump = useJumpToMediaTime()
  const playing = usePlaybackSecond(post.uri)
  const duration = usePlaybackDuration(post.uri)
  const themeName = useThemeName()
  const goBack = useGoBack()
  const {bottom} = useSafeAreaInsets()
  const {width, height} = useWindowDimensions()
  const playerRef = useRef<VideoPlayer | null>(null)
  const ratio = video.aspectRatio
    ? video.aspectRatio.width / video.aspectRatio.height
    : 16 / 9
  const videoHeight = Math.min(width / ratio, height * MAX_VIDEO_HEIGHT_SHARE)
  const {moments, loading} = useVideoMomentsWithStatus({
    videoPostUri: post.uri,
    threadItems,
  })
  const moment = momentAt(moments, seconds)
  const onPressSecond = (pressed: number) => {
    const target = momentAt(moments, pressed)
    jump(post.uri, target ? target.startSeconds : pressed)
    if (target && target !== moment) onSelectSeconds(target.startSeconds)
  }

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
        startSeconds={seconds}
        style={{height: videoHeight}}
        playerRef={playerRef}
      />
      <View style={[a.px_lg, a.pt_md]}>
        <MomentStrip
          moments={moments}
          current={moment}
          duration={duration}
          playing={playing}
          onPressSecond={onPressSecond}
        />
      </View>
      <View style={[a.flex_1, a.pt_md]}>
        <ThemeProvider theme={themeName}>
          <MomentRoom
            layout="sheet"
            videoPost={post}
            videoModeration={item.moderation}
            threadgateRecord={threadgateRecord}
            moment={moment}
            moments={moments}
            seconds={seconds}
            loading={loading}
            bottomInset={bottom}
            onBeforeCompose={() => playerRef.current?.pause()}
            onClose={goBack}
          />
        </ThemeProvider>
      </View>
    </ContentHider>
  )
}
