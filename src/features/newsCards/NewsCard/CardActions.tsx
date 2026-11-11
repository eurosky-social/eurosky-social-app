import {type GestureResponderEvent, View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {makeProfileLink} from '#/lib/routes/links'
import {type Shadow} from '#/state/cache/post-shadow'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {
  usePostLikeMutationQueue,
  usePostRepostMutationQueue,
} from '#/state/queries/post'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as Liked,
  Heart2_Stroke2_Corner0_Rounded as Like,
} from '#/components/icons/Heart2'
import {Reply_Stroke2_Corner0_Rounded as Comment} from '#/components/icons/Reply'
import {Link} from '#/components/Link'
import {BookmarkButton} from '#/components/PostControls/BookmarkButton'
import {
  PostControlButton,
  PostControlButtonIcon,
} from '#/components/PostControls/PostControlButton'
import {RepostButton} from '#/components/PostControls/RepostButton'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {cardTimeBucket} from '../model'

/** Pointer targets reach 24px with a mouse and 44px on touch. */
const HIT_SLOP = {top: 10, bottom: 10, left: 6, right: 6}

/** "2m ago" under a day, then "Yesterday", then a short date; full date for tooltips. */
export function useCardTime(createdAt: string) {
  const {t: l, i18n} = useLingui()
  const getTimeAgo = useGetTimeAgo()
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return {label: '', full: ''}
  const now = new Date()
  const bucket = cardTimeBucket(created, now)
  const label =
    bucket.kind === 'now'
      ? l`Just now`
      : bucket.kind === 'relative'
        ? l`${getTimeAgo(createdAt, now)} ago`
        : bucket.kind === 'yesterday'
          ? l`Yesterday`
          : i18n.date(created, {day: 'numeric', month: 'short'})
  const full = i18n.date(created, {dateStyle: 'medium', timeStyle: 'short'})
  return {label, full}
}

function isBlocked(post: app.bsky.feed.defs.PostView) {
  return !!(
    post.author.viewer?.blocking ||
    post.author.viewer?.blockedBy ||
    post.author.viewer?.blockingByList
  )
}

/**
 * Time and post actions. Icons that change state are real buttons; counts and
 * the comment icon open the post for pointer users but stay out of the tab
 * order, because the card link's accessible name already carries the numbers.
 */
export function CardActions({
  post,
  createdAt,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  createdAt: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const time = useCardTime(createdAt)
  const requireAuth = useRequireAuth()
  const {openComposer} = useOpenComposer()
  const {feedDescriptor} = useFeedFeedbackContext()
  const [like, unlike] = usePostLikeMutationQueue(
    post,
    undefined,
    feedDescriptor,
    'FeedItem',
  )
  const [repost, unrepost] = usePostRepostMutationQueue(
    post,
    undefined,
    feedDescriptor,
    'FeedItem',
  )
  const postLink = makeProfileLink(
    post.author,
    'post',
    new AtUri(post.uri).rkey,
  )
  const liked = !!post.viewer?.like
  const reposted = !!post.viewer?.repost

  const guard = () => {
    if (!isBlocked(post)) return true
    Toast.show(l`Cannot interact with a blocked user`, {type: 'warning'})
    return false
  }
  const fail = (error: unknown) => {
    if ((error as Error)?.name !== 'AbortError')
      Toast.show(l`An issue occurred, please try again.`, {type: 'error'})
  }
  const onLike = (event: GestureResponderEvent) => {
    event?.preventDefault?.()
    requireAuth(() => {
      if (!guard()) return
      void (liked ? unlike() : like()).catch(fail)
    })
  }
  const onRepost = () => {
    if (!guard()) return
    void (reposted ? unrepost() : repost()).catch(fail)
  }
  const onQuote = () => {
    if (!guard()) return
    openComposer({quote: post, logContext: 'QuotePost'})
  }

  const countStyle = [
    a.text_sm,
    t.atoms.text_contrast_medium,
    {fontVariant: ['tabular-nums' as const]},
  ]
  const countLink = (testID: string, count: number) => (
    <Link
      testID={testID}
      to={postLink}
      label={String(count)}
      tabIndex={-1}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      hitSlop={HIT_SLOP}
      style={[a.pr_sm, {minHeight: 24, minWidth: 16}]}>
      <Text style={countStyle}>{count}</Text>
    </Link>
  )

  return (
    <View
      testID="newsCardActions"
      pointerEvents="box-none"
      style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
      <View
        testID="newsCardTimeWrap"
        pointerEvents="none"
        style={{flexShrink: 0}}>
        <Text
          testID="newsCardTime"
          title={time.full}
          style={[
            a.text_sm,
            t.atoms.text_contrast_medium,
            {fontVariant: ['tabular-nums']},
          ]}
          numberOfLines={1}>
          {time.label}
        </Text>
      </View>
      <View
        pointerEvents="box-none"
        style={[a.flex_row, a.align_center, web({zIndex: 2})]}>
        <Link
          testID="newsCardCommentIcon"
          to={postLink}
          label={l`Open conversation`}
          tabIndex={-1}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          hitSlop={HIT_SLOP}
          style={[{padding: 5}]}>
          <Comment width={18} fill={t.palette.contrast_500} />
        </Link>
        {countLink('newsCardCommentCount', post.replyCount ?? 0)}
        <RepostButton
          isReposted={reposted}
          repostCount={undefined}
          onRepost={onRepost}
          onQuote={onQuote}
          embeddingDisabled={!!post.viewer?.embeddingDisabled}
        />
        {countLink(
          'newsCardRepostCount',
          (post.repostCount ?? 0) + (post.quoteCount ?? 0),
        )}
        <PostControlButton
          testID="newsCardLike"
          active={liked}
          activeColor={t.palette.pink}
          label={liked ? l`Unlike` : l`Like`}
          accessibilityState={{selected: liked}}
          hitSlop={HIT_SLOP}
          onPress={onLike}>
          <PostControlButtonIcon icon={liked ? Liked : Like} />
        </PostControlButton>
        {countLink('newsCardLikeCount', post.likeCount ?? 0)}
        <BookmarkButton post={post} logContext="FeedItem" hitSlop={HIT_SLOP} />
      </View>
    </View>
  )
}
