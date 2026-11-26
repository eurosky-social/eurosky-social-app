import {ActivityIndicator, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {atoms as a} from '#/alf'
import * as Layout from '#/components/Layout'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {Text} from '#/components/Typography'
import {ComposerField} from '#/features/mediaTime/components/ComposerField'
import {MomentsTimeline} from '#/features/mediaTime/components/MomentsTimeline'
import {MomentStrip} from '#/features/mediaTime/components/MomentStrip'
import {VideoTitleBlock} from '#/features/mediaTime/components/VideoTitleBlock'
import {openMoment} from '#/features/mediaTime/openMoment'
import {
  getOwnVideoEmbed,
  parseMediaTimeParam,
} from '#/features/mediaTime/record'
import {useJumpToMediaTime} from '#/features/mediaTime/useJumpToMediaTime'
import {useMediaTimeParam} from '#/features/mediaTime/useMediaTimeParam'
import {
  usePlaybackDuration,
  usePlaybackSecond,
} from '#/features/mediaTime/usePlaybackSecond'
import {useVideoMomentsWithStatus} from '#/features/mediaTime/useVideoMoments'
import {momentStatuses} from '#/features/mediaTime/watching'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>

/**
 * A post's video with its moments (web; design canvas "Watching, with
 * moments"): the post's own player, which jumps to second `t`, where people
 * commented along it, and the moments as a timeline.
 */
export function PostVideoScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostVideo'>) {
  const {name, rkey, t: tParam} = route.params
  const {t: l} = useLingui()
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const startSeconds = parseMediaTimeParam(tParam) ?? 0

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
  const jump = useJumpToMediaTime()
  const playing = usePlaybackSecond(postUri)
  const duration = usePlaybackDuration(postUri)
  const {moments, loading} = useVideoMomentsWithStatus({
    videoPostUri: postUri,
    threadItems: thread.data.items,
    enabled: hasVideo,
  })
  const now = moments[momentStatuses(moments, playing).indexOf('now')]
  const authorName = anchor
    ? sanitizeDisplayName(
        anchor.value.post.author.displayName || anchor.value.post.author.handle,
        anchor.moderation.ui('displayName'),
      )
    : undefined

  return (
    <Layout.Screen testID="postVideoScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Moments</Trans>
          </Layout.Header.TitleText>
          {authorName ? (
            <Layout.Header.SubtitleText>
              <Trans>Video by {authorName}</Trans>
            </Layout.Header.SubtitleText>
          ) : null}
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {anchor && post && embed && hasVideo ? (
        <MomentsTimeline
          moments={moments}
          loading={loading}
          playing={playing}
          threadgateRecord={thread.data.threadgate?.record}
          onOpenMoment={moment => openMoment(postUri, moment.startSeconds)}
          header={
            <>
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
                    current={now}
                    duration={duration}
                    playing={playing}
                    onPressSecond={seconds => jump(postUri, seconds)}
                  />
                </View>
              </ContentHider>
              <VideoTitleBlock
                post={post}
                moderation={anchor.moderation}
                moments={moments}
              />
              <View style={[a.px_lg, a.pb_md]}>
                <ComposerField
                  videoPost={post}
                  videoModeration={anchor.moderation}
                  fallbackSeconds={startSeconds}
                  placeholder={l`Add a comment…`}
                />
              </View>
            </>
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
