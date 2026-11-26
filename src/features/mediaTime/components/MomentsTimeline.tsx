import {useEffect, useMemo, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {moderatePost} from '@bsky/sdk/moderation'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useMergedThreadgateHiddenReplies} from '#/state/threadgate-hidden-replies'
import {List, type ListMethods} from '#/view/com/util/List'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {type app} from '#/lexicons'
import {commentText} from '../momentPosts'
import {isMoment, type Moment} from '../moments'
import {formatMediaTime} from '../record'
import {useMomentPosts} from '../useMomentPosts'
import {useMomentTitle} from '../useMomentTitle'
import {
  busiestMoment,
  foldedMomentCount,
  type MomentStatus,
  type TimelineRow,
  timelineRows,
} from '../watching'

type PostView = app.bsky.feed.defs.PostView
type CommentRow = Extract<TimelineRow, {kind: 'comment'}>

/**
 * A video's moments as a timeline that follows playback (design canvas
 * "Watching, with moments"): the moment playing is highlighted, older past
 * moments fold into one row, and moments ahead keep their comments hidden
 * until playback gets there, unless revealed. Tapping a moment opens it.
 *
 * Groups too small to be moments (`isMoment`) show as their comments, one
 * row each (design canvas "Few comments yet"); tapping one plays the video
 * from its second. Without any moment, the list is "Comments along the
 * video".
 *
 * On phones, and in the desktop web panel, the list scrolls by itself, and
 * "Follow the video" keeps the moment playing in view (`canFollow`). On a
 * narrow web page it scrolls with the page, below `header`.
 */
export function MomentsTimeline({
  moments,
  loading,
  playing,
  threadgateRecord,
  header,
  canFollow = !IS_WEB,
  onOpenMoment,
  onPlaySecond,
}: {
  /** All of the video's groups of comments, moments or not. */
  moments: Moment[]
  loading: boolean
  /** The second being watched, once the player has reported one. */
  playing: number | undefined
  threadgateRecord?: app.bsky.feed.threadgate.Main
  /** Shown above the moments, scrolling with them. */
  header?: React.ReactNode
  /**
   * Whether the list scrolls by itself, so it can keep the moment playing in
   * view. Not on a web page that scrolls as a whole.
   */
  canFollow?: boolean
  onOpenMoment: (moment: Moment) => void
  /** Plays the video from a single comment's second. */
  onPlaySecond: (seconds: number) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listRef = useRef<ListMethods>(null)
  const [follow, setFollow] = useState(true)
  const [showEarlier, setShowEarlier] = useState(false)
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set())

  const allRows = useMemo(
    () => timelineRows(moments, playing),
    [moments, playing],
  )
  const realMoments = useMemo(() => moments.filter(isMoment), [moments])
  const busiest = busiestMoment(realMoments)

  // Single comments show their post: load those on screen and not hidden.
  const shownUris = allRows
    .filter(
      (row): row is CommentRow =>
        row.kind === 'comment' &&
        (row.status !== 'ahead' || revealed.has(row.key)),
    )
    .map(row => row.comment.uri)
  const urisKey = shownUris.join(' ')
  const commentUris = useMemo(
    () => (urisKey ? urisKey.split(' ') : []),
    [urisKey],
  )
  const posts = useMomentPosts(commentUris)
  const moderationOpts = useModerationOpts()
  const hiddenUris = useMergedThreadgateHiddenReplies({threadgateRecord})
  const postsByUri = useMemo(
    () =>
      new Map<string, PostView>(
        posts.data?.map(post => [post.uri, post]) ?? [],
      ),
    [posts.data],
  )
  // Leave out comments the video's author hid or the viewer filters out,
  // as on a moment's page.
  const rows = allRows.filter(row => {
    if (row.kind === 'moment') return true
    const post = postsByUri.get(row.comment.uri)
    if (!post || !moderationOpts) return true
    return (
      !hiddenUris.has(post.uri) &&
      !moderatePost(post, moderationOpts).ui('contentList').filter
    )
  })

  const foldCount = foldedMomentCount(rows.map(row => row.status))
  const shown = rows.slice(showEarlier ? 0 : foldCount)
  const nowIndex = shown.findIndex(row => row.status === 'now')

  useEffect(() => {
    if (!canFollow || !follow || nowIndex < 0) return
    listRef.current?.scrollToIndex({
      index: nowIndex,
      viewPosition: 0.3,
      animated: true,
    })
  }, [canFollow, follow, nowIndex])

  const foldedRows = rows.slice(0, foldCount)
  const foldedMoments = foldedRows.filter(row => row.kind === 'moment').length
  const foldedComments = foldedRows.length - foldedMoments
  const foldedLabel = [
    foldedMoments > 0
      ? plural(foldedMoments, {
          one: '# earlier moment',
          other: '# earlier moments',
        })
      : undefined,
    foldedComments > 0
      ? plural(foldedComments, {
          one: '# earlier comment',
          other: '# earlier comments',
        })
      : undefined,
    ...foldedRows.map(row => formatMediaTime(row.seconds)),
  ]
    .filter(Boolean)
    .join(' · ')
  const hideEarlierLabel =
    foldedComments > 0 ? l`Hide earlier comments` : l`Hide earlier moments`
  const listHeader = (
    <>
      {header}
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.px_lg,
          a.py_sm,
          header ? [a.border_t, t.atoms.border_contrast_low] : null,
        ]}>
        <Text style={[a.text_md, a.font_bold]}>
          {realMoments.length > 0 ? (
            <>
              <Trans>Moments</Trans>
              <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                {` · ${realMoments.length}`}
              </Text>
            </>
          ) : (
            <Trans>Comments along the video</Trans>
          )}
        </Text>
        {!canFollow ? null : (
          <Toggle.Item
            name="followVideo"
            label={l`Follow the video`}
            value={follow}
            onChange={setFollow}
            style={[a.flex_row, a.align_center, a.gap_sm]}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Follow the video</Trans>
            </Text>
            <Toggle.Switch />
          </Toggle.Item>
        )}
      </View>
      {realMoments.length === 0 && rows.length > 0 ? (
        <View style={[a.px_lg, a.pb_sm]}>
          <NoMomentsYet />
        </View>
      ) : null}
      {foldCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showEarlier ? hideEarlierLabel : foldedLabel}
          accessibilityHint=""
          onPress={() => setShowEarlier(!showEarlier)}
          style={[a.flex_row, a.align_stretch]}>
          <Rail />
          <Text
            style={[
              a.flex_1,
              a.py_sm,
              a.pr_lg,
              a.text_sm,
              a.font_semi_bold,
              t.atoms.text_contrast_medium,
            ]}>
            {showEarlier ? hideEarlierLabel : foldedLabel}
          </Text>
        </Pressable>
      ) : null}
    </>
  )

  return (
    <List
      ref={listRef}
      data={shown}
      keyExtractor={(row: TimelineRow) => row.key}
      renderItem={({item}: {item: TimelineRow}) =>
        item.kind === 'moment' ? (
          <TimelineMoment
            moment={item.moment}
            status={item.status}
            busiest={item.moment === busiest}
            revealed={revealed.has(item.key)}
            onReveal={() => setRevealed(new Set([...revealed, item.key]))}
            onOpen={() => onOpenMoment(item.moment)}
            threadgateRecord={threadgateRecord}
          />
        ) : (
          <TimelineComment
            row={item}
            post={postsByUri.get(item.comment.uri)}
            revealed={revealed.has(item.key)}
            onReveal={() => setRevealed(new Set([...revealed, item.key]))}
            onPlay={() => onPlaySecond(item.seconds)}
          />
        )
      }
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        loading ? (
          <View style={[a.py_2xl, a.align_center]}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={[a.px_lg, a.py_lg]}>
            <NoMomentsYet />
          </View>
        )
      }
      ListFooterComponent={<View style={{height: 24}} />}
      onScrollToIndexFailed={({averageItemLength, index}) => {
        listRef.current?.scrollToOffset({
          offset: averageItemLength * index,
          animated: true,
        })
      }}
      desktopFixedHeight={false}
    />
  )
}

function NoMomentsYet() {
  const t = useTheme()
  return (
    <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
      <Trans>
        No moments yet. A moment forms where several people comment close to the
        same second.
      </Trans>
    </Text>
  )
}

/** The line along the left of the timeline. */
function Rail({children}: {children?: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[{width: 52}, a.flex_shrink_0]}>
      <View
        style={[
          a.absolute,
          t.atoms.bg_contrast_100,
          {left: 25, top: 0, bottom: 0, width: 2},
        ]}
      />
      {children}
    </View>
  )
}

/** The dot on the line: larger for moments with more comments. */
function dotSize(count: number) {
  return count > 100 ? 14 : count > 50 ? 11 : count > 25 ? 9 : 7
}

function TimelineMoment({
  moment,
  status,
  busiest,
  revealed,
  onReveal,
  onOpen,
  threadgateRecord,
}: {
  moment: Moment
  status: MomentStatus
  busiest: boolean
  revealed: boolean
  onReveal: () => void
  onOpen: () => void
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const hidden = status === 'ahead' && !revealed
  const {title, people} = useMomentTitle({
    moment,
    threadgateRecord,
    enabled: !hidden,
  })
  const time = formatMediaTime(moment.startSeconds)
  const comments = plural(moment.count, {
    one: '# comment',
    other: '# comments',
  })
  const tag =
    status === 'now'
      ? l`Now playing`
      : busiest
        ? l`Most discussed`
        : title && !hidden
          ? l`From the comments`
          : undefined
  const meta = hidden
    ? l`${comments} · shown when you get there`
    : people
      ? l({
          message: `${comments} · ${plural(people, {one: '# person', other: '# people'})}`,
          comment:
            'Under a video moment: how many comments, and by how many people, e.g. 12 comments · 9 people',
        })
      : comments
  const size = dotSize(moment.count)
  const cardStyle: StyleProp<ViewStyle> = [
    a.flex_1,
    a.rounded_md,
    a.border,
    a.gap_xs,
    {marginVertical: 4, marginRight: 16, padding: 12},
    status === 'now'
      ? {
          backgroundColor: t.palette.primary_50,
          borderColor: t.palette.primary_500,
        }
      : status === 'ahead'
        ? [t.atoms.border_contrast_low, {borderStyle: 'dashed'}]
        : [t.atoms.bg_contrast_25, {borderColor: 'transparent'}],
  ]
  const content = (
    <>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <Text
          style={[
            a.text_sm,
            a.font_bold,
            {color: t.palette.primary_600, fontVariant: ['tabular-nums']},
          ]}>
          {time}
        </Text>
        {tag ? (
          <View
            style={[
              a.rounded_sm,
              {paddingHorizontal: 6, paddingVertical: 2},
              status === 'now'
                ? {backgroundColor: t.palette.primary_500}
                : t.atoms.bg_contrast_50,
            ]}>
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                status === 'now'
                  ? {color: t.palette.white}
                  : t.atoms.text_contrast_high,
              ]}>
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      {hidden ? null : (
        <Text
          style={[a.text_md, a.font_semi_bold, a.leading_snug]}
          numberOfLines={3}>
          {title ? `“${title}”` : l`Moment at ${time}`}
        </Text>
      )}
      <View style={[a.flex_row, a.align_center, a.gap_md, a.flex_wrap]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{meta}</Text>
        {hidden ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l`Show this moment's comments now`}
            accessibilityHint=""
            hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
            onPress={onReveal}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                {color: t.palette.primary_600},
              ]}>
              <Trans>Show</Trans>
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  )

  return (
    <View
      testID={`timelineMoment-${moment.startSeconds}`}
      style={[a.flex_row, a.align_stretch]}>
      <Rail>
        <View
          style={[
            a.absolute,
            {
              top: 20,
              left: 26 - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor:
                status === 'ahead'
                  ? t.palette.contrast_300
                  : t.palette.primary_500,
            },
          ]}
        />
      </Rail>
      {hidden ? (
        // Not pressable until revealed: opening it would show its comments,
        // and "Show" can't sit inside another button on the web.
        <View style={cardStyle}>{content}</View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l`Moment at ${time}: ${title ?? ''}, ${meta}`}
          accessibilityHint={l`Opens the moment and plays the video from there`}
          onPress={onOpen}
          style={cardStyle}>
          {content}
        </Pressable>
      )}
    </View>
  )
}

/**
 * A single comment along the video, from a group too small to be a moment:
 * its time on the line, who wrote it and what. Ahead of playback it stays
 * hidden until revealed. Tapping it plays the video from its second.
 */
function TimelineComment({
  row,
  post,
  revealed,
  onReveal,
  onPlay,
}: {
  row: CommentRow
  /** The comment's post, once loaded. */
  post: PostView | undefined
  revealed: boolean
  onReveal: () => void
  onPlay: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const {status, forming} = row
  const hidden = status === 'ahead' && !revealed
  const time = formatMediaTime(row.seconds)
  const cardStyle: StyleProp<ViewStyle> = [
    a.flex_1,
    a.rounded_md,
    a.border,
    a.gap_xs,
    {marginVertical: 4, marginRight: 16, padding: 12},
    status === 'now'
      ? {
          backgroundColor: t.palette.primary_50,
          borderColor: t.palette.primary_500,
        }
      : status === 'ahead'
        ? [t.atoms.border_contrast_low, {borderStyle: 'dashed'}]
        : [t.atoms.bg_contrast_25, {borderColor: 'transparent'}],
  ]
  const rail = (
    <Rail>
      <Text
        style={[
          a.absolute,
          a.text_center,
          a.text_xs,
          a.font_bold,
          t.atoms.bg,
          {
            top: 16,
            left: 0,
            right: 0,
            fontVariant: ['tabular-nums'],
            color:
              status === 'ahead'
                ? t.palette.contrast_500
                : t.palette.primary_600,
          },
        ]}>
        {time}
      </Text>
    </Rail>
  )

  if (hidden) {
    return (
      <View
        testID={`timelineComment-${row.seconds}`}
        style={[a.flex_row, a.align_stretch]}>
        {rail}
        <View style={cardStyle}>
          <View style={[a.flex_row, a.align_center, a.gap_md, a.flex_wrap]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>1 comment here · shown when you get there</Trans>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={l`Show this comment now`}
              accessibilityHint=""
              hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
              onPress={onReveal}>
              <Text
                style={[
                  a.text_sm,
                  a.font_semi_bold,
                  {color: t.palette.primary_600},
                ]}>
                <Trans>Show</Trans>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  const moderation =
    post && moderationOpts ? moderatePost(post, moderationOpts) : undefined
  const inList = moderation?.ui('contentList')
  const text = post ? commentText(post) : undefined
  const name = post
    ? sanitizeDisplayName(
        post.author.displayName || post.author.handle,
        moderation?.ui('displayName'),
      )
    : undefined
  const warned = !!inList && (inList.blur || inList.alert)

  return (
    <View
      testID={`timelineComment-${row.seconds}`}
      style={[a.flex_row, a.align_stretch]}>
      {rail}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          name ? l`Comment by ${name} at ${time}` : l`Comment at ${time}`
        }
        accessibilityHint={l`Plays the video from there`}
        onPress={onPlay}
        style={cardStyle}>
        {forming ? (
          <Text
            style={[a.text_xs, a.font_bold, {color: t.palette.primary_600}]}>
            {l({
              message: `Forming a moment · ${forming.count} comments around ${formatMediaTime(forming.aroundSeconds)} · one more makes it`,
              comment:
                'Above a comment on a video, when it and one other comment are close together; one more would make them a moment, e.g. Forming a moment · 2 comments around 3:00 · one more makes it',
            })}
          </Text>
        ) : null}
        {post ? (
          <>
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              <UserAvatar
                size={24}
                avatar={post.author.avatar}
                moderation={moderation?.ui('avatar')}
                type={post.author.associated?.labeler ? 'labeler' : 'user'}
              />
              <Text
                emoji
                style={[a.flex_shrink, a.text_sm, a.font_bold]}
                numberOfLines={1}>
                {name}
              </Text>
              <TimeElapsed timestamp={post.indexedAt}>
                {({timeElapsed}) => (
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    {timeElapsed}
                  </Text>
                )}
              </TimeElapsed>
            </View>
            {warned ? (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Hidden by your moderation settings</Trans>
              </Text>
            ) : text ? (
              <Text emoji style={[a.text_md, a.leading_snug]} numberOfLines={4}>
                {text}
              </Text>
            ) : null}
          </>
        ) : (
          <ActivityIndicator style={[a.self_start]} />
        )}
      </Pressable>
    </View>
  )
}
