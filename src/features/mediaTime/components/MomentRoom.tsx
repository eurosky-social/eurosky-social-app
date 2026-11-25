import {useMemo, useState} from 'react'
import {ActivityIndicator, Pressable, View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {
  moderatePost,
  type ModerationDecision,
  type ModerationOpts,
} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {usePostLikeMutationQueue} from '#/state/queries/post'
import {useProfileQuery} from '#/state/queries/profile'
import {useRequireAuth, useSession} from '#/state/session'
import {useMergedThreadgateHiddenReplies} from '#/state/threadgate-hidden-replies'
import {List} from '#/view/com/util/List'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {PreviewableUserAvatar, UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartFilledIcon,
  Heart2_Stroke2_Corner0_Rounded as HeartIcon,
} from '#/components/icons/Heart2'
import {Play_Filled_Corner0_Rounded as PlayIcon} from '#/components/icons/Play'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/Times'
import {InlineLinkText} from '#/components/Link'
import {ContentHider} from '#/components/moderation/ContentHider'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {PostMenuButton} from '#/components/PostControls/PostMenu'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {
  type MomentSort,
  pickCommentReplies,
  sortMomentPosts,
  visibleMomentPosts,
} from '../momentPosts'
import {type Moment} from '../moments'
import {formatMediaTime, withoutMediaTimeLink} from '../record'
import {useCommentReplies} from '../useCommentReplies'
import {useJumpToMediaTime} from '../useJumpToMediaTime'
import {useMomentPosts} from '../useMomentPosts'
import {usePlaybackSecond} from '../usePlaybackSecond'

type PostView = app.bsky.feed.defs.PostView

/** A comment quoted as a moment's title is cut after this many characters. */
const TITLE_MAX_CHARS = 120

/**
 * One moment of a video and its comments, as one conversation (design canvas
 * "One moment's room"): the moment's span (tap to play from its start), a
 * title, how many comments it has, the comments sorted by top or newest, and
 * a field to add one at the second being watched.
 *
 * `layout="sheet"` (phones) draws it as a sheet under the video: its top
 * stays put, the comments scroll, and the field sits at the bottom.
 * `layout="page"` (web) scrolls with the page, below `header`.
 */
export function MomentRoom({
  layout,
  videoPost,
  videoModeration,
  threadgateRecord,
  moment,
  moments,
  seconds,
  loading,
  header,
  bottomInset = 0,
  onBeforeCompose,
  onClose,
}: {
  layout: 'sheet' | 'page'
  videoPost: PostView & {record: app.bsky.feed.post.Main}
  videoModeration: ModerationDecision
  threadgateRecord?: app.bsky.feed.threadgate.Main
  /** The moment to show; `undefined` when no moment holds `seconds`. */
  moment: Moment | undefined
  /** All of the video's moments, to tell whether this one is the busiest. */
  moments: Moment[]
  /** The second the page was opened at. */
  seconds: number
  /** Whether the moments are still loading. */
  loading: boolean
  /** Shown above the room, scrolling with it (`layout="page"`). */
  header?: React.ReactNode
  bottomInset?: number
  /** Called before the composer opens, e.g. to pause the video. */
  onBeforeCompose?: () => void
  /** Shows a close button that calls this (`layout="sheet"`). */
  onClose?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [sort, setSort] = useState<MomentSort>('top')

  const uris = useMemo(() => moment?.comments.map(c => c.uri) ?? [], [moment])
  const secondsByUri = useMemo(
    () => new Map(moment?.comments.map(c => [c.uri, c.seconds]) ?? []),
    [moment],
  )
  const posts = useMomentPosts(uris)
  const moderationOpts = useModerationOpts()
  const hiddenUris = useMergedThreadgateHiddenReplies({threadgateRecord})
  const visible = useMemo(
    () =>
      posts.data && moderationOpts
        ? visibleMomentPosts(posts.data, hiddenUris, moderationOpts)
        : [],
    [posts.data, moderationOpts, hiddenUris],
  )
  const sorted = useMemo(() => sortMomentPosts(visible, sort), [visible, sort])

  const top = (
    <RoomTop
      moment={moment}
      moments={moments}
      seconds={seconds}
      visible={visible}
      videoPostUri={videoPost.uri}
      sort={sort}
      onSort={setSort}
      onClose={onClose}
    />
  )
  const composerField = (
    <ComposerField
      videoPost={videoPost}
      videoModeration={videoModeration}
      fallbackSeconds={moment?.startSeconds ?? seconds}
      onBeforeCompose={onBeforeCompose}
    />
  )

  let empty: React.ReactNode
  if (loading || (uris.length > 0 && (posts.isPending || !moderationOpts))) {
    empty = (
      <View style={[a.py_2xl, a.align_center]}>
        <ActivityIndicator />
      </View>
    )
  } else if (posts.isError) {
    empty = (
      <View style={[a.px_lg, a.py_xl, a.gap_md, a.align_start]}>
        <Text style={[a.text_md, a.leading_snug]}>
          <Trans>The comments could not be loaded.</Trans>
        </Text>
        <Pill
          label={l`Try again`}
          text={l`Try again`}
          onPress={() => void posts.refetch()}
        />
      </View>
    )
  } else {
    empty = (
      <View style={[a.px_lg, a.py_xl]}>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          {moment ? (
            <Trans>No comments to show at this moment.</Trans>
          ) : (
            <Trans>
              No comments at {formatMediaTime(seconds)} yet. Be the first.
            </Trans>
          )}
        </Text>
      </View>
    )
  }

  const list = (
    <List
      data={sorted}
      keyExtractor={(post: PostView) => post.uri}
      renderItem={({item}: {item: PostView}) => (
        <MomentComment
          post={item}
          seconds={secondsByUri.get(item.uri)}
          videoPostUri={videoPost.uri}
          hostDid={videoPost.author.did}
          threadgateRecord={threadgateRecord}
          hiddenUris={hiddenUris}
        />
      )}
      ListHeaderComponent={
        layout === 'page' ? (
          <>
            {header}
            {top}
            <View
              style={[
                a.px_lg,
                a.py_md,
                a.border_b,
                t.atoms.border_contrast_low,
              ]}>
              {composerField}
            </View>
          </>
        ) : undefined
      }
      ListEmptyComponent={empty}
      ListFooterComponent={
        <View style={{height: layout === 'page' ? 120 : 24}} />
      }
      desktopFixedHeight={false}
    />
  )

  if (layout === 'page') {
    return <View style={[a.flex_1]}>{list}</View>
  }

  return (
    <View
      style={[
        a.flex_1,
        a.overflow_hidden,
        t.atoms.bg,
        {borderTopLeftRadius: 20, borderTopRightRadius: 20},
      ]}>
      <View style={[a.align_center, a.pt_sm]}>
        <View
          style={[
            t.atoms.bg_contrast_200,
            {width: 36, height: 4, borderRadius: 2},
          ]}
        />
      </View>
      {top}
      <View style={[a.flex_1]}>{list}</View>
      <View
        style={[
          a.px_lg,
          a.pt_sm,
          a.border_t,
          t.atoms.border_contrast_low,
          {paddingBottom: bottomInset + 12},
        ]}>
        {composerField}
      </View>
    </View>
  )
}

/**
 * The moment's span, a tag, its title and count, the close button and the
 * sort pills.
 */
function RoomTop({
  moment,
  moments,
  seconds,
  visible,
  videoPostUri,
  sort,
  onSort,
  onClose,
}: {
  moment: Moment | undefined
  moments: Moment[]
  seconds: number
  visible: PostView[]
  videoPostUri: string
  sort: MomentSort
  onSort: (sort: MomentSort) => void
  onClose?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const jump = useJumpToMediaTime()
  const moderationOpts = useModerationOpts()

  const startSeconds = moment?.startSeconds ?? seconds
  const start = formatMediaTime(startSeconds)
  const end = moment ? formatMediaTime(moment.endSeconds) : start
  const span = start === end ? start : `${start} – ${end}`
  const allListed = !!moment && moment.comments.length >= moment.count
  const busiest =
    !!moment &&
    moments.length > 1 &&
    moments.every(m => m === moment || m.count < moment.count)
  // An unnamed moment takes its title from its top comment, as in the
  // design. A moment of one comment would only repeat it.
  const quote =
    moment && moment.count > 1 && moderationOpts
      ? topQuote(sortMomentPosts(visible, 'top'), moderationOpts)
      : undefined
  const people = new Set(visible.map(p => p.author.did)).size
  const comments = moment
    ? plural(moment.count, {one: '# comment', other: '# comments'})
    : ''
  const tag = busiest
    ? l`Most discussed`
    : quote
      ? l`From the comments`
      : undefined

  return (
    <View
      style={[
        a.px_lg,
        a.pt_md,
        a.pb_md,
        a.gap_md,
        a.border_b,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_row, a.align_start, a.gap_md]}>
        <View style={[a.flex_1, a.gap_xs]}>
          <View style={[a.flex_row, a.align_center, a.gap_sm, a.flex_wrap]}>
            <TimeChip
              testID="momentPlay"
              label={l`Play from ${start}`}
              onPress={() => jump(videoPostUri, startSeconds)}>
              {span}
            </TimeChip>
            {tag ? (
              <Text
                style={[
                  a.text_sm,
                  a.font_semi_bold,
                  t.atoms.text_contrast_medium,
                ]}>
                {tag}
              </Text>
            ) : null}
          </View>
          <Text
            style={[a.text_xl, a.font_bold, a.leading_snug, a.pt_xs]}
            numberOfLines={3}>
            {quote ? `“${quote}”` : l`Moment at ${start}`}
          </Text>
          {moment ? (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {allListed && people > 0
                ? l({
                    message: `${comments} · ${plural(people, {one: '# person', other: '# people'})}`,
                    comment:
                      'Under a video moment: how many comments, and by how many people, e.g. 12 comments · 9 people',
                  })
                : comments}
            </Text>
          ) : null}
          {moment && !allListed ? (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>
                Showing the first {moment.comments.length} of {moment.count}{' '}
                comments.
              </Trans>
            </Text>
          ) : null}
        </View>
        {onClose ? (
          <Button
            label={l`Close this moment`}
            size="large"
            shape="round"
            color="secondary"
            onPress={onClose}>
            <ButtonIcon icon={CloseIcon} />
          </Button>
        ) : null}
      </View>
      {moment ? (
        <View
          style={[a.flex_row, a.gap_sm]}
          accessibilityRole="radiogroup"
          accessibilityLabel={l`Sort comments`}
          accessibilityHint="">
          <Pill
            label={l`Top`}
            text={l`Top`}
            selected={sort === 'top'}
            onPress={() => onSort('top')}
          />
          <Pill
            label={l`Newest`}
            text={l`Newest`}
            selected={sort === 'newest'}
            onPress={() => onSort('newest')}
          />
        </View>
      ) : null}
    </View>
  )
}

/**
 * The text of the most liked comment that shows without a warning, without
 * its time link, cut to `TITLE_MAX_CHARS`.
 */
function topQuote(
  postsByLikes: PostView[],
  moderationOpts: ModerationOpts,
): string | undefined {
  for (const post of postsByLikes) {
    if (!bsky.matches(app.bsky.feed.post, post.record)) continue
    const modui = moderatePost(post, moderationOpts).ui('contentView')
    if (modui.blur || modui.alert) continue
    const text = withoutMediaTimeLink(
      new RichTextAPI({text: post.record.text, facets: post.record.facets}),
    )
      .text.replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    return text.length > TITLE_MAX_CHARS
      ? `${text.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`
      : text
  }
  return undefined
}

/** One comment, with the first replies to it underneath. */
function MomentComment({
  post: rawPost,
  seconds,
  videoPostUri,
  hostDid,
  threadgateRecord,
  hiddenUris,
}: {
  post: PostView
  seconds: number | undefined
  videoPostUri: string
  hostDid: string
  threadgateRecord?: app.bsky.feed.threadgate.Main
  hiddenUris: ReadonlySet<string>
}) {
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const post = usePostShadow(rawPost)
  const moderation = useMemo(
    () => (moderationOpts ? moderatePost(rawPost, moderationOpts) : undefined),
    [rawPost, moderationOpts],
  )
  if (post === POST_TOMBSTONE || !moderation) return null
  if (!bsky.matches(app.bsky.feed.post, post.record)) return null
  return (
    <View
      testID={`momentComment-${post.uri}`}
      style={[
        a.px_lg,
        a.pt_md,
        a.pb_xs,
        a.border_b,
        t.atoms.border_contrast_low,
      ]}>
      <ReportDialogMetadataContext.Provider>
        <CommentRow
          post={post}
          record={post.record}
          moderation={moderation}
          seconds={seconds}
          videoPostUri={videoPostUri}
          isHost={post.author.did === hostDid}
          threadgateRecord={threadgateRecord}
        />
      </ReportDialogMetadataContext.Provider>
      <CommentReplies
        comment={post}
        hostDid={hostDid}
        videoPostUri={videoPostUri}
        threadgateRecord={threadgateRecord}
        hiddenUris={hiddenUris}
      />
    </View>
  )
}

/**
 * Up to two replies to a comment, the video's author's first, and a link to
 * the rest in the comment's thread.
 */
function CommentReplies({
  comment,
  hostDid,
  videoPostUri,
  threadgateRecord,
  hiddenUris,
}: {
  comment: Shadow<PostView>
  hostDid: string
  videoPostUri: string
  threadgateRecord?: app.bsky.feed.threadgate.Main
  hiddenUris: ReadonlySet<string>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const total = comment.replyCount ?? 0
  const {data} = useCommentReplies(comment.uri, total > 0)
  const moderationOpts = useModerationOpts()
  const shown = useMemo(
    () =>
      data && moderationOpts
        ? pickCommentReplies(
            visibleMomentPosts(data, hiddenUris, moderationOpts),
            hostDid,
          )
        : [],
    [data, moderationOpts, hiddenUris, hostDid],
  )
  if (total === 0) return null
  const href = makeProfileLink(
    comment.author,
    'post',
    new AtUri(comment.uri).rkey,
  )
  const more = total - shown.length
  return (
    <View style={[a.gap_xs, {paddingLeft: 48}]}>
      {shown.map(reply => (
        <MomentReply
          key={reply.uri}
          post={reply}
          isHost={reply.author.did === hostDid}
          videoPostUri={videoPostUri}
          threadgateRecord={threadgateRecord}
        />
      ))}
      {more > 0 ? (
        <View style={[a.pb_sm]}>
          <InlineLinkText
            to={href}
            label={l`Open all replies to this comment`}
            style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            {shown.length === 0
              ? plural(total, {one: '# reply', other: '# replies'})
              : plural(more, {one: '# more reply', other: '# more replies'})}
          </InlineLinkText>
        </View>
      ) : null}
    </View>
  )
}

function MomentReply({
  post: rawPost,
  isHost,
  videoPostUri,
  threadgateRecord,
}: {
  post: PostView
  isHost: boolean
  videoPostUri: string
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const moderationOpts = useModerationOpts()
  const post = usePostShadow(rawPost)
  const moderation = useMemo(
    () => (moderationOpts ? moderatePost(rawPost, moderationOpts) : undefined),
    [rawPost, moderationOpts],
  )
  if (post === POST_TOMBSTONE || !moderation) return null
  if (!bsky.matches(app.bsky.feed.post, post.record)) return null
  return (
    <ReportDialogMetadataContext.Provider>
      <CommentRow
        nested
        post={post}
        record={post.record}
        moderation={moderation}
        seconds={undefined}
        videoPostUri={videoPostUri}
        isHost={isHost}
        threadgateRecord={threadgateRecord}
      />
    </ReportDialogMetadataContext.Provider>
  )
}

/**
 * Who wrote a comment or reply and when, a "Host" badge for the video's
 * author, the comment's second, its text, and Reply, likes and the menu.
 */
function CommentRow({
  post,
  record,
  moderation,
  seconds,
  nested,
  isHost,
  videoPostUri,
  threadgateRecord,
}: {
  post: Shadow<PostView>
  record: app.bsky.feed.post.Main
  moderation: ModerationDecision
  seconds: number | undefined
  nested?: boolean
  isHost: boolean
  videoPostUri: string
  threadgateRecord?: app.bsky.feed.threadgate.Main
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const jump = useJumpToMediaTime()
  const requireAuth = useRequireAuth()
  const {openComposer} = useOpenComposer()
  const [queueLike, queueUnlike] = usePostLikeMutationQueue(
    post,
    undefined,
    undefined,
    'Post',
  )
  const fullText = useMemo(
    () => new RichTextAPI({text: record.text, facets: record.facets}),
    [record],
  )
  const richText = useMemo(() => withoutMediaTimeLink(fullText), [fullText])
  const name = sanitizeDisplayName(
    post.author.displayName || post.author.handle,
    moderation.ui('displayName'),
  )
  const liked = !!post.viewer?.like
  const likes = post.likeCount ?? 0
  const likesLabel = plural(likes, {one: '# like', other: '# likes'})
  const time = seconds !== undefined ? formatMediaTime(seconds) : undefined

  const onReply = () =>
    requireAuth(() =>
      openComposer({
        replyTo: {
          uri: post.uri,
          cid: post.cid,
          text: record.text,
          author: post.author,
          embed: post.embed,
          langs: record.langs,
          moderation,
        },
        logContext: 'PostReply',
      }),
    )
  const onLike = () =>
    requireAuth(() => {
      const change = liked ? queueUnlike() : queueLike()
      change.catch((e: unknown) => {
        if ((e as Error)?.name !== 'AbortError') throw e
      })
    })

  return (
    <View style={[a.flex_row, nested ? a.gap_sm : a.gap_md]}>
      <PreviewableUserAvatar
        size={nested ? 28 : 36}
        profile={post.author}
        moderation={moderation.ui('avatar')}
        type={post.author.associated?.labeler ? 'labeler' : 'user'}
      />
      <View style={[a.flex_1, a.gap_2xs]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs, a.flex_wrap]}>
          <Text
            emoji
            style={[a.text_sm, a.font_bold, a.flex_shrink]}
            numberOfLines={1}>
            {name}
          </Text>
          {isHost ? (
            <View
              style={[
                a.rounded_sm,
                {
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  backgroundColor: t.palette.primary_50,
                },
              ]}>
              <Text
                style={[
                  a.text_xs,
                  a.font_bold,
                  {color: t.palette.primary_600},
                ]}>
                <Trans comment="Badge next to a reply by the person who posted the video">
                  Host
                </Trans>
              </Text>
            </View>
          ) : null}
          <TimeElapsed timestamp={post.indexedAt}>
            {({timeElapsed}) => (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                · {timeElapsed}
              </Text>
            )}
          </TimeElapsed>
          {seconds !== undefined && time ? (
            <TimeChip
              small
              label={l`Jump to ${time} in the video`}
              onPress={() => jump(videoPostUri, seconds)}>
              {time}
            </TimeChip>
          ) : null}
        </View>
        <ContentHider
          modui={moderation.ui('contentView')}
          childContainerStyle={[a.gap_xs]}>
          <PostAlerts post={post} modui={moderation.ui('contentView')} />
          {richText.text ? (
            <RichText
              enableTags
              value={richText}
              style={[nested ? a.text_sm : a.text_md, a.leading_snug]}
              authorHandle={post.author.handle}
              shouldProxyLinks
            />
          ) : null}
          {post.embed ? (
            <Embed
              embed={post.embed}
              moderation={moderation}
              viewContext={PostEmbedViewContext.Feed}
              post={post}
            />
          ) : null}
        </ContentHider>
        <View style={[a.flex_row, a.align_center, a.gap_lg]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l`Reply`}
            accessibilityHint=""
            disabled={!!post.viewer?.replyDisabled}
            onPress={onReply}
            style={[a.py_sm]}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Reply</Trans>
            </Text>
          </Pressable>
          <Pressable
            testID="momentCommentLike"
            accessibilityRole="button"
            accessibilityLabel={
              liked ? l`Unlike, ${likesLabel}` : l`Like, ${likesLabel}`
            }
            accessibilityHint=""
            onPress={onLike}
            style={[a.flex_row, a.align_center, a.gap_xs, a.py_sm]}>
            {liked ? (
              <HeartFilledIcon size="sm" fill={t.palette.pink} />
            ) : (
              <HeartIcon size="sm" style={t.atoms.text_contrast_medium} />
            )}
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                liked ? {color: t.palette.pink} : t.atoms.text_contrast_medium,
              ]}>
              {likes}
            </Text>
          </Pressable>
          <View style={[a.flex_1]} />
          <PostMenuButton
            testID="momentCommentMenu"
            post={post}
            postFeedContext={undefined}
            postReqId={undefined}
            record={record}
            richText={fullText}
            timestamp={post.indexedAt}
            threadgateRecord={threadgateRecord}
            logContext="Post"
            forceGoogleTranslate={false}
          />
        </View>
      </View>
    </View>
  )
}

/**
 * "at 0:41 · Add to this moment…": opens the composer, linked to the second
 * being watched (or the moment's start before the video has played).
 */
function ComposerField({
  videoPost,
  videoModeration,
  fallbackSeconds,
  onBeforeCompose,
}: {
  videoPost: PostView & {record: app.bsky.feed.post.Main}
  videoModeration: ModerationDecision
  fallbackSeconds: number
  onBeforeCompose?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {openComposer} = useOpenComposer()
  const requireAuth = useRequireAuth()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const playing = usePlaybackSecond(videoPost.uri)
  const commentSeconds =
    playing !== undefined && playing > 0 ? playing : fallbackSeconds
  const time = formatMediaTime(commentSeconds)

  const onPress = () =>
    requireAuth(() => {
      onBeforeCompose?.()
      openComposer({
        replyTo: {
          uri: videoPost.uri,
          cid: videoPost.cid,
          text: videoPost.record.text,
          author: videoPost.author,
          embed: videoPost.embed,
          langs: videoPost.record.langs,
          moderation: videoModeration,
        },
        mediaTime: commentSeconds,
        logContext: 'PostReply',
      })
    })

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {profile ? (
        <UserAvatar
          size={36}
          avatar={profile.avatar}
          type={profile.associated?.labeler ? 'labeler' : 'user'}
        />
      ) : null}
      <Pressable
        testID="momentAddComment"
        accessibilityRole="button"
        accessibilityLabel={l`Add a comment at ${time}`}
        accessibilityHint=""
        onPress={onPress}
        style={[
          a.flex_1,
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.rounded_full,
          a.border,
          t.atoms.bg_contrast_25,
          t.atoms.border_contrast_low,
          {height: 44, paddingHorizontal: 6},
        ]}>
        <View
          style={[
            a.rounded_full,
            a.justify_center,
            {
              height: 32,
              paddingHorizontal: 10,
              backgroundColor: t.palette.primary_50,
            },
          ]}>
          <Text
            style={[
              a.text_xs,
              a.font_bold,
              {color: t.palette.primary_600, fontVariant: ['tabular-nums']},
            ]}>
            <Trans comment="Before a comment field: the second of the video the comment will be linked to, e.g. at 0:41">
              at {time}
            </Trans>
          </Text>
        </View>
        <Text
          style={[a.text_md, a.flex_shrink, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          <Trans>Add to this moment…</Trans>
        </Text>
      </Pressable>
    </View>
  )
}

/** A tinted pill with a play triangle and a time, e.g. "▶ 0:41". */
function TimeChip({
  label,
  onPress,
  small,
  testID,
  children,
}: {
  label: string
  onPress: () => void
  small?: boolean
  testID?: string
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint=""
      onPress={onPress}
      hitSlop={small ? {top: 10, bottom: 10, left: 6, right: 6} : undefined}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_2xs,
        a.rounded_sm,
        {
          backgroundColor: t.palette.primary_50,
          paddingHorizontal: small ? 6 : 8,
          paddingVertical: small ? 2 : 4,
        },
      ]}>
      <PlayIcon size="xs" fill={t.palette.primary_600} />
      <Text
        style={[
          small ? a.text_xs : a.text_sm,
          a.font_bold,
          {color: t.palette.primary_600, fontVariant: ['tabular-nums']},
        ]}>
        {children}
      </Text>
    </Pressable>
  )
}

/** A round button that can be selected, e.g. a sort option. */
function Pill({
  label,
  text,
  selected,
  onPress,
}: {
  label: string
  text: string
  selected?: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={
        selected === undefined ? undefined : {checked: selected}
      }
      accessibilityLabel={label}
      accessibilityHint=""
      onPress={onPress}
      style={[
        a.rounded_full,
        a.border,
        a.justify_center,
        {height: 36, paddingHorizontal: 14},
        selected
          ? [t.atoms.bg_contrast_975, {borderColor: 'transparent'}]
          : [t.atoms.bg, t.atoms.border_contrast_low],
      ]}>
      <Text
        style={[
          a.text_sm,
          a.font_semi_bold,
          selected ? t.atoms.text_inverted : t.atoms.text_contrast_high,
        ]}>
        {text}
      </Text>
    </Pressable>
  )
}
