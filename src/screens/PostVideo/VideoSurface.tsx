import {useCallback, useEffect, useRef} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useEventListener} from 'expo'
import {useVideoPlayer, type VideoPlayer, VideoView} from 'expo-video'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native'

import {getHomeNavigationAction} from '#/lib/routes/navigation'
import {type NavigationProp} from '#/lib/routes/types'
import {useSetLightStatusBar} from '#/state/shell/light-status-bar'
import {atoms as a, useTheme} from '#/alf'
import {setSystemUITheme} from '#/alf/util/systemUI'
import {Button, ButtonIcon} from '#/components/Button'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeftIcon} from '#/components/icons/Arrow'
import {ChevronLeft_Stroke2_Corner0_Rounded as BackIcon} from '#/components/icons/Chevron'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {
  registerSeekTarget,
  reportPlaybackPosition,
} from '#/features/mediaTime/playback'
import {type app} from '#/lexicons'

/*
 * Shared by the full-screen player (PostVideo) and a moment's page
 * (PostMoment) on iOS and Android.
 */

/** Dark system bars while the screen is in front. */
export function useVideoScreenChrome() {
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
}

/**
 * A post's video, playing from `startSeconds`. Reports where it is (for the
 * composer and "at 0:41" labels), takes jumps and pauses from time links and
 * moments on its screen, and pauses when another screen covers it.
 */
export function VideoSurface({
  postUri,
  video,
  moderation,
  startSeconds,
  style,
  playerRef,
}: {
  postUri: string
  video: app.bsky.embed.video.View
  moderation: ModerationDecision
  startSeconds: number
  style?: StyleProp<ViewStyle>
  /** Set to the player, e.g. to pause it before the composer opens. */
  playerRef?: React.RefObject<VideoPlayer | null>
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()

  const player = useVideoPlayer(video.playlist, p => {
    p.timeUpdateEventInterval = 0.5
  })

  usePlayFrom(player, startSeconds)

  useEffect(() => {
    if (!playerRef) return
    playerRef.current = player
    return () => {
      playerRef.current = null
    }
  }, [player, playerRef])

  // Pause when another screen covers this one.
  useFocusEffect(
    useCallback(() => {
      return () => player.pause()
    }, [player]),
  )

  useEventListener(player, 'timeUpdate', ({currentTime}) => {
    reportPlaybackPosition(postUri, currentTime, player.duration)
  })

  useEffect(() => {
    return registerSeekTarget(postUri, {
      seek: seconds => {
        player.currentTime = seconds
        player.play()
      },
      pause: () => player.pause(),
      isActive: () => navigation.isFocused(),
    })
  }, [player, postUri, navigation])

  return (
    <ContentHider
      modui={moderation.ui('contentMedia')}
      style={style}
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

export function Unavailable() {
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.px_xl]}>
      <Text style={[a.text_md, a.text_center, a.leading_snug]}>
        <Trans>This video is not available.</Trans>
      </Text>
    </View>
  )
}

export function BackButton() {
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

/** Goes back, or home when there is nothing to go back to. */
export function useGoBack() {
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

/** A dark bar with a back button and the video's title. */
export function VideoHeaderBar({title}: {title: string | undefined}) {
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
