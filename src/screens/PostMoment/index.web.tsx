import {ActivityIndicator, View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {
  useWideVideoLayout,
  WideVideoMoments,
} from '#/screens/PostVideo/WideVideoMoments'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
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
import {useMediaTimeParam} from '#/features/mediaTime/useMediaTimeParam'
import {usePauseAtMomentEnd} from '#/features/mediaTime/usePauseAtMomentEnd'
import {
  usePlaybackDuration,
  usePlaybackSecond,
} from '#/features/mediaTime/usePlaybackSecond'
import {useVideoMomentsWithStatus} from '#/features/mediaTime/useVideoMoments'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>

/**
 * A moment's screen on the web: on a wide window, the video's two columns
 * with the moment open in the panel (`WideVideoMoments`), otherwise one page.
 */
export function PostMomentScreen(
  props: NativeStackScreenProps<CommonNavigatorParams, 'PostMoment'>,
) {
  const wide = useWideVideoLayout()
  const {name, rkey, t} = props.route.params
  return wide ? (
    <WideVideoMoments
      name={name}
      rkey={rkey}
      t={t}
      openSeconds={parseMediaTimeParam(t) ?? 0}
    />
  ) : (
    <PostMomentPage {...props} />
  )
}

/**
 * One moment of a post's video and its comments (web): the post's video,
 * which jumps to second `t`, and the moment holding that second below it.
 */
function PostMomentPage({
  route,
  navigation,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostMoment'>) {
  const {name, rkey, t: tParam} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const seconds = parseMediaTimeParam(tParam) ?? 0

  const thread = usePostThread({anchor: uri})
  const anchor = thread.data.items.find(
    (item): item is ThreadPostItem =>
      item.type === 'threadPost' && item.depth === 0,
  )
  const post = anchor?.value.post
  const embed = post?.embed
  const hasVideo = !!getOwnVideoEmbed(embed)
  // `uri` may name the account by its handle; moments and players use the
  // post's own URI, which names it by its DID.
  const postUri = post?.uri ?? uri
  // the video below picks the jump up once its player mounts
  useMediaTimeParam({postUri, name, rkey, t: post ? tParam : undefined})
  const {moments, loading} = useVideoMomentsWithStatus({
    videoPostUri: postUri,
    threadItems: thread.data.items,
    enabled: hasVideo,
  })
  const moment = momentAt(moments, seconds)
  usePauseAtMomentEnd(postUri, moment)
  const jump = useJumpToMediaTime()
  const playing = usePlaybackSecond(postUri)
  const duration = usePlaybackDuration(postUri)
  const onPressSecond = (pressed: number) => {
    const target = momentAt(moments, pressed)
    jump(postUri, target ? target.startSeconds : pressed)
    if (target && target !== moment) {
      navigation.setParams({t: String(target.startSeconds)})
    }
  }
  const authorName = anchor
    ? sanitizeDisplayName(
        anchor.value.post.author.displayName || anchor.value.post.author.handle,
        anchor.moderation.ui('displayName'),
      )
    : undefined
  const title = (post && getVideoTitle(post.record.text)) ?? authorName

  return (
    <Layout.Screen testID="postMomentScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
          {authorName ? (
            <Layout.Header.SubtitleText>
              <Trans>Video by {authorName}</Trans>
            </Layout.Header.SubtitleText>
          ) : null}
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {anchor && post && embed && hasVideo ? (
        <MomentRoom
          layout="page"
          videoPost={post}
          videoModeration={anchor.moderation}
          threadgateRecord={thread.data.threadgate?.record}
          moment={moment}
          moments={moments}
          seconds={seconds}
          loading={loading}
          header={
            <ContentHider
              modui={anchor.moderation.ui('contentView')}
              ignoreMute
              style={[a.px_lg, a.pt_md]}>
              <Embed
                embed={embed}
                moderation={anchor.moderation}
                viewContext={PostEmbedViewContext.ThreadHighlighted}
                post={post}
              />
              <View style={[a.pt_md]}>
                <MomentStrip
                  moments={moments}
                  current={moment}
                  duration={duration}
                  playing={playing}
                  onPressSecond={onPressSecond}
                />
              </View>
            </ContentHider>
          }
        />
      ) : thread.state.isFetching ? (
        <View style={[a.py_2xl, a.align_center]}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={[a.px_lg, a.py_2xl]}>
          <Text style={[a.text_md, a.text_center, a.leading_snug]}>
            <Trans>This video is not available.</Trans>
          </Text>
        </View>
      )}
    </Layout.Screen>
  )
}
