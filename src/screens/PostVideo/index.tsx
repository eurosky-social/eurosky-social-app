import {useRef} from 'react'
import {ActivityIndicator, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {type VideoPlayer} from 'expo-video'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {atoms as a, ThemeProvider} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Bubble_Stroke2_Corner2_Rounded as CommentIcon} from '#/components/icons/Bubble'
import {KeepAwake} from '#/components/KeepAwake'
import * as Layout from '#/components/Layout'
import {ContentHider} from '#/components/moderation/ContentHider'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {MomentChips} from '#/features/mediaTime/components/MomentChips'
import {openMoment} from '#/features/mediaTime/openMoment'
import {
  formatMediaTime,
  getOwnVideoEmbed,
  parseMediaTimeParam,
} from '#/features/mediaTime/record'
import {usePlaybackSecond} from '#/features/mediaTime/usePlaybackSecond'
import {useVideoMoments} from '#/features/mediaTime/useVideoMoments'
import {type app} from '#/lexicons'
import {
  BackButton,
  Unavailable,
  useVideoScreenChrome,
  VideoSurface,
} from './VideoSurface'

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
  useVideoScreenChrome()

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
  const {openComposer} = useOpenComposer()
  const playerRef = useRef<VideoPlayer | null>(null)

  const commentSeconds = usePlaybackSecond(post.uri) ?? startSeconds
  const commentTime = formatMediaTime(commentSeconds)
  const moments = useVideoMoments({videoPostUri: post.uri, threadItems})
  const richText = new RichTextAPI({
    text: post.record.text,
    facets: post.record.facets,
  })
  const authorName = sanitizeDisplayName(
    post.author.displayName || post.author.handle,
    item.moderation.ui('displayName'),
  )

  const onPressComment = () => {
    playerRef.current?.pause()
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
      <VideoSurface
        postUri={post.uri}
        video={video}
        moderation={item.moderation}
        startSeconds={startSeconds}
        style={[a.flex_1]}
        playerRef={playerRef}
      />
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
          onPressMoment={moment => openMoment(post.uri, moment.startSeconds)}
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
