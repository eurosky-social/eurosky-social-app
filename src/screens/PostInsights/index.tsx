import {ActivityIndicator, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {usePostThread} from '#/state/queries/usePostThread'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {MomentHeatStrip} from '#/features/mediaTime/components/MomentHeatStrip'
import {MEDIA_TIME_ENABLED} from '#/features/mediaTime/config'
import {
  insightCounts,
  INSIGHTS_STRIP_BARS,
  type StripLabel,
  stripLabels,
  waitingForAnswer,
} from '#/features/mediaTime/insights'
import {isMoment, type Moment} from '#/features/mediaTime/moments'
import {topMoments} from '#/features/mediaTime/momentSummaries'
import {openMoment} from '#/features/mediaTime/openMoment'
import {
  formatMediaTime,
  getOwnVideoEmbed,
  getVideoTitle,
} from '#/features/mediaTime/record'
import {useMomentTitle} from '#/features/mediaTime/useMomentTitle'
import {useVideoMomentsWithStatus} from '#/features/mediaTime/useVideoMoments'
import {useVideoDuration} from '#/features/mediaTime/videoDuration'
import {type app} from '#/lexicons'

type ThreadPostItem = Extract<ThreadItem, {type: 'threadPost'}>

const STRIP_HEIGHT = 56
const LABEL_WIDTH = 44
/** Labels closer than this share of the strip's width would overlap. */
const LABEL_MIN_GAP = 0.14

/**
 * A video's insights for its author (design canvas "funk's view of the
 * episode"): how many comments it has, where along the video they are, and
 * the moments with comments still waiting for the author's reply. Others
 * who open the address are told it's only for the author.
 */
export function PostInsightsScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'PostInsights'>) {
  const {name, rkey} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const {currentAccount} = useSession()
  const thread = usePostThread({anchor: uri})
  const anchor = thread.data.items.find(
    (item): item is ThreadPostItem =>
      item.type === 'threadPost' && item.depth === 0,
  )
  const post = anchor?.value.post
  const video = post ? getOwnVideoEmbed(post.embed) : undefined
  const isAuthor = !!post && currentAccount?.did === post.author.did

  return (
    <Layout.Screen testID="postInsightsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Video insights</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        {post && video && isAuthor && MEDIA_TIME_ENABLED ? (
          <Insights
            post={post}
            video={video}
            threadItems={thread.data.items}
            threadgateRecord={thread.data.threadgate?.record}
          />
        ) : !post && thread.state.isFetching ? (
          <View style={[a.py_5xl, a.align_center]}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <NoticeText>
            {!post || !video || !MEDIA_TIME_ENABLED ? (
              <Trans>This video's insights aren't available.</Trans>
            ) : (
              <Trans>Only the video's author can see its insights.</Trans>
            )}
          </NoticeText>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}

function Insights({
  post,
  video,
  threadItems,
  threadgateRecord,
}: {
  post: app.bsky.feed.defs.PostView & {record: app.bsky.feed.post.Main}
  video: app.bsky.embed.video.View
  threadItems: ThreadItem[]
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {moments: groups, loading} = useVideoMomentsWithStatus({
    videoPostUri: post.uri,
    threadItems,
  })
  const duration = useVideoDuration({
    postUri: post.uri,
    playlist: video.playlist,
  })
  const title = getVideoTitle(post.record.text)
  const {total, linked, wholeVideo} = insightCounts(groups, post.replyCount)
  const top = topMoments(groups)
  const labels = stripLabels(top, duration, LABEL_MIN_GAP)
  const waiting = waitingForAnswer(groups)
  const totalLabel = plural(total, {one: '# comment', other: '# comments'})
  const counts =
    linked === 0
      ? totalLabel
      : wholeVideo === 0
        ? plural(linked, {
            one: '# comment along the video',
            other: '# comments along the video',
          })
        : l({
            message: `${totalLabel} · ${linked} along the video · ${wholeVideo} on the whole video`,
            comment:
              "A video's comments: all of them, those linked to a second of it, and the others, e.g. 412 comments · 374 along the video · 38 on the whole video",
          })

  return (
    <View style={[a.px_lg, a.pt_md, a.pb_2xl, a.gap_md]}>
      <View style={[a.gap_xs]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <LockIcon size="xs" fill={t.atoms.text_contrast_medium.color} />
          <Text
            style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            <Trans>Only you see this page</Trans>
          </Text>
        </View>
        {title ? (
          <Text
            emoji
            style={[a.text_lg, a.font_bold, a.leading_snug]}
            numberOfLines={3}>
            {title}
          </Text>
        ) : null}
        <Text
          testID="insightsCounts"
          style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {counts}
        </Text>
      </View>

      <Card title={l`Where viewers commented`}>
        {loading ? (
          <ActivityIndicator />
        ) : linked > 0 ? (
          <View style={[a.gap_xs]}>
            <MomentHeatStrip
              moments={groups}
              highlighted={top}
              duration={duration}
              bars={INSIGHTS_STRIP_BARS}
              height={STRIP_HEIGHT}
            />
            <StripLabels labels={labels} />
          </View>
        ) : (
          <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_high]}>
            <Trans>
              No comments are linked to a second of the video yet. Comments
              written while watching it are.
            </Trans>
          </Text>
        )}
      </Card>

      {!loading && waiting && linked > 0 ? (
        <Card title={l`Waiting for your answer`}>
          {waiting.length > 0 ? (
            <View>
              {waiting.map(group => (
                <WaitingRow
                  key={`${group.startSeconds}-${group.endSeconds}`}
                  group={group}
                  videoPostUri={post.uri}
                  threadgateRecord={threadgateRecord}
                />
              ))}
            </View>
          ) : (
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_high]}>
              <Trans>
                You've replied to every comment linked to a second of the video.
              </Trans>
            </Text>
          )}
        </Card>
      ) : null}
    </View>
  )
}

function Card({title, children}: {title: string; children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.p_md,
        a.gap_sm,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      <Text accessibilityRole="header" style={[a.text_md, a.font_bold]}>
        {title}
      </Text>
      {children}
    </View>
  )
}

/** The times of the biggest moments, under the large strip. */
function StripLabels({labels}: {labels: StripLabel[]}) {
  const t = useTheme()
  if (labels.length === 0) return null
  return (
    <View style={[{height: 18}]}>
      {labels.map(label => {
        // keep labels at the ends inside the strip
        const place =
          label.at < 0.07
            ? {left: 0}
            : label.at > 0.93
              ? {right: 0}
              : {
                  left: `${label.at * 100}%` as const,
                  marginLeft: -LABEL_WIDTH / 2,
                }
        return (
          <Text
            key={label.seconds}
            style={[
              a.absolute,
              a.text_xs,
              a.font_bold,
              {
                width: LABEL_WIDTH,
                textAlign:
                  label.at < 0.07
                    ? 'left'
                    : label.at > 0.93
                      ? 'right'
                      : 'center',
                color: t.palette.primary_600,
                fontVariant: ['tabular-nums'],
              },
              place,
            ]}>
            {label.text}
          </Text>
        )
      })}
    </View>
  )
}

/**
 * A moment, or a comment or two at a second, with comments by others the
 * author hasn't replied to. "Answer" opens its page, where they can reply.
 */
function WaitingRow({
  group,
  videoPostUri,
  threadgateRecord,
}: {
  group: Moment
  videoPostUri: string
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {title} = useMomentTitle({
    moment: group,
    threadgateRecord,
    enabled: true,
  })
  const time = formatMediaTime(group.startSeconds)
  const unanswered = group.unansweredCount ?? 0
  const name =
    title ?? (isMoment(group) ? l`Moment at ${time}` : l`Comment at ${time}`)
  return (
    <View
      testID={`insightsWaiting-${group.startSeconds}`}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.py_sm,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <Text
        style={[
          a.text_sm,
          a.font_bold,
          {
            width: 52,
            color: t.palette.primary_600,
            fontVariant: ['tabular-nums'],
          },
        ]}>
        {time}
      </Text>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji numberOfLines={2} style={[a.text_sm, a.font_semi_bold]}>
          {name}
        </Text>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {plural(unanswered, {
            one: '# comment without your reply',
            other: '# comments without your reply',
          })}
        </Text>
      </View>
      <Button
        testID={`insightsAnswer-${group.startSeconds}`}
        label={l`Answer the comments at ${time}`}
        size="small"
        color="primary"
        onPress={() => openMoment(videoPostUri, group.startSeconds)}>
        <ButtonText>
          <Trans>Answer</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function NoticeText({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.px_lg,
        a.py_2xl,
        a.text_md,
        a.leading_snug,
        t.atoms.text_contrast_high,
      ]}>
      {children}
    </Text>
  )
}
