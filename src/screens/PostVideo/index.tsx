import {useCallback, useEffect, useRef} from 'react'
import {ActivityIndicator, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useEvent, useEventListener} from 'expo'
import {useVideoPlayer, type VideoPlayer, VideoView} from 'expo-video'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {getHomeNavigationAction} from '#/lib/routes/navigation'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {useSetLightStatusBar} from '#/state/shell/light-status-bar'
import {atoms as a, ThemeProvider, useTheme} from '#/alf'
import {setSystemUITheme} from '#/alf/util/systemUI'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeftIcon} from '#/components/icons/Arrow'
import {Bubble_Stroke2_Corner2_Rounded as CommentIcon} from '#/components/icons/Bubble'
import {KeepAwake} from '#/components/KeepAwake'
import * as Layout from '#/components/Layout'
import {ContentHider} from '#/components/moderation/ContentHider'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {MomentChips} from '#/features/mediaTime/components/MomentChips'
import {
  collectTimedReplies,
  groupIntoMoments,
} from '#/features/mediaTime/moments'
import {
  registerSeekTarget,
  reportPlaybackPosition,
} from '#/features/mediaTime/playback'
import {
  formatMediaTime,
  getOwnVideoEmbed,
  parseMediaTimeParam,
} from '#/features/mediaTime/record'
import {type app} from '#/lexicons'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>

/**
 * Full-screen player for one post's video, opened at a given second (the
 * `t` parameter). Used on iOS and Android, where the inline player in feeds
 * and threads cannot jump to a time.
 */
export function PostVideoScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostVideo'>) {
  const {name, rkey, t: tParam} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const startSeconds = parseMediaTimeParam(tParam) ?? 0
  const t = useTheme()

  useFocusEffect(
    useCallback(() => {
      setSystemUITheme('lightbox', t)
      return () => {
        setSystemUITheme('theme', t)
      }
    }, [t]),
  )
  useSetLightStatusBar(useIsFocused())

  const thread = usePostThread({anchor: uri})
  const anchor = thread.data.items.find(
    (item): item is ThreadPostItem =>
      item.type === 'threadPost' && item.depth === 0,
  )
  const video = anchor ? getOwnVideoEmbed(anchor.value.post.embed) : undefined

  return (
    <ThemeProvider theme="dark">
      <Layout.Screen
        testID="postVideoScreen"
        minimalShell
        fullBleed
        noInsetTop
        style={{backgroundColor: 'black'}}>
        <KeepAwake />
        {anchor && video ? (
          <Player
            item={anchor}
            video={video}
            startSeconds={startSeconds}
            threadItems={thread.data.items}
          />
        ) : thread.state.isFetching ? (
          <View style={[a.flex_1, a.align_center, a.justify_center]}>
            <ActivityIndicator size="large" color="white" />
          </View>
        ) : (
          <Unavailable />
        )}
        <BackButton />
      </Layout.Screen>
    </ThemeProvider>
  )
}

function Player({
  item,
  video,
  startSeconds,
  threadItems,
}: {
  item: ThreadPostItem
  video: app.bsky.embed.video.View
  startSeconds: number
  threadItems: ThreadItem[]
}) {
  const post = item.value.post
  const {t: l} = useLingui()
  const {bottom} = useSafeAreaInsets()
  const navigation = useNavigation<NavigationProp>()
  const {openComposer} = useOpenComposer()

  const player = useVideoPlayer(video.playlist, p => {
    p.timeUpdateEventInterval = 0.5
  })

  usePlayFrom(player, startSeconds)

  // Pause when another screen covers this one.
  useFocusEffect(
    useCallback(() => {
      return () => player.pause()
    }, [player]),
  )

  useEventListener(player, 'timeUpdate', ({currentTime}) => {
    reportPlaybackPosition(post.uri, currentTime, player.duration)
  })
  const {currentTime} = useEvent(player, 'timeUpdate', {
    currentTime: startSeconds,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  })

  useEffect(() => {
    return registerSeekTarget(post.uri, {
      seek: seconds => {
        player.currentTime = seconds
        player.play()
      },
      isActive: () => navigation.isFocused(),
    })
  }, [player, post.uri, navigation])

  const commentSeconds = Math.floor(currentTime)
  const commentTime = formatMediaTime(commentSeconds)
  const moments = groupIntoMoments(collectTimedReplies(threadItems, post.uri))
  const richText = new RichTextAPI({
    text: post.record.text,
    facets: post.record.facets,
  })
  const authorName = sanitizeDisplayName(
    post.author.displayName || post.author.handle,
    item.moderation.ui('displayName'),
  )

  const onPressComment = () => {
    player.pause()
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: post.record.text,
        author: post.author,
        embed: post.embed,
        langs: post.record.langs,
        moderation: item.moderation,
      },
      mediaTime: commentSeconds,
      logContext: 'PostReply',
    })
  }

  return (
    <ContentHider
      modui={item.moderation.ui('contentView')}
      ignoreMute
      style={[a.flex_1]}
      childContainerStyle={[a.flex_1]}>
      <ContentHider
        modui={item.moderation.ui('contentMedia')}
        style={[a.flex_1]}
        childContainerStyle={[a.flex_1]}>
        <VideoView
          testID="postVideoPlayer"
          style={[a.flex_1]}
          player={player}
          nativeControls
          contentFit="contain"
          accessibilityLabel={video.alt ? l`Video: ${video.alt}` : l`Video`}
          accessibilityHint={l`Use the player controls to pause or seek`}
        />
      </ContentHider>
      <View style={[a.px_lg, a.pt_md, a.gap_md, {paddingBottom: bottom + 12}]}>
        <View style={[a.gap_xs]}>
          <Text emoji style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
            {authorName}
          </Text>
          {richText.text ? (
            <RichText
              value={richText}
              style={[a.text_sm, a.leading_snug]}
              numberOfLines={3}
              authorHandle={post.author.handle}
            />
          ) : null}
        </View>
        <MomentChips
          moments={moments}
          onPressMoment={moment => {
            player.currentTime = moment.startSeconds
            player.play()
          }}
        />
        <Button
          testID="postVideoComment"
          label={l`Comment at ${commentTime}`}
          size="large"
          color="primary"
          onPress={onPressComment}>
          <ButtonIcon icon={CommentIcon} />
          <ButtonText>
            <Trans>Comment at {commentTime}</Trans>
          </ButtonText>
        </Button>
      </View>
    </ContentHider>
  )
}

/**
 * Jumps to `seconds` once the video can play, then starts playback. Seeking
 * before the player is ready is ignored by the native players.
 */
function usePlayFrom(player: VideoPlayer, seconds: number) {
  const started = useRef(false)
  useEventListener(player, 'statusChange', ({status}) => {
    if (status !== 'readyToPlay' || started.current) return
    started.current = true
    if (seconds > 0) {
      player.currentTime = seconds
    }
    player.play()
  })
}

function Unavailable() {
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.px_xl]}>
      <Text style={[a.text_md, a.text_center, a.leading_snug]}>
        <Trans>This video is not available.</Trans>
      </Text>
    </View>
  )
}

function BackButton() {
  const {t: l} = useLingui()
  const {top} = useSafeAreaInsets()
  const navigation = useNavigation<NavigationProp>()
  return (
    <View style={[a.absolute, a.z_50, {top: top + 8, left: 12}]}>
      <Button
        testID="postVideoBack"
        label={l`Go back`}
        size="small"
        color="secondary_inverted"
        shape="round"
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack()
          } else {
            navigation.dispatch(
              getHomeNavigationAction(navigation.getState(), 'navigate'),
            )
          }
        }}>
        <ButtonIcon icon={ArrowLeftIcon} />
      </Button>
    </View>
  )
}
