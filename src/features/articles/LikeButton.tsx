import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {type Shadow} from '#/state/cache/post-shadow'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {usePostLikeMutationQueue} from '#/state/queries/post'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as Liked,
  Heart2_Stroke2_Corner0_Rounded as Like,
} from '#/components/icons/Heart2'
import {
  PostControlButton,
  PostControlButtonIcon,
  PostControlButtonText,
} from '#/components/PostControls/PostControlButton'
import {useFormatPostStatCount} from '#/components/PostControls/util'
import * as Toast from '#/components/Toast'
import {type app} from '#/lexicons'

/** Use the normal mutation queue so likes, counts and rollback are shared with threads. */
export function ArticleLikeButton({
  post,
  vertical = false,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  vertical?: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const requireAuth = useRequireAuth()
  const {feedDescriptor} = useFeedFeedbackContext()
  const [like, unlike] = usePostLikeMutationQueue(
    post,
    undefined,
    feedDescriptor,
    'FeedItem',
  )
  const formatCount = useFormatPostStatCount()
  const liked = !!post.viewer?.like
  const count = post.likeCount ?? 0
  const blocked = !!(
    post.author.viewer?.blocking ||
    post.author.viewer?.blockedBy ||
    post.author.viewer?.blockingByList
  )
  const toggle = async () => {
    if (blocked) {
      Toast.show(l`Cannot interact with a blocked user`, {type: 'warning'})
      return
    }
    try {
      if (liked) await unlike()
      else await like()
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError')
        Toast.show(l`An issue occurred, please try again.`, {type: 'error'})
    }
  }
  return (
    <PostControlButton
      testID="editorialLikes"
      {...(vertical ? {style: [a.flex_col, a.gap_xs]} : {})}
      active={liked}
      activeColor={t.palette.pink}
      label={
        liked
          ? l`Unlike (${plural(count, {one: '# like', other: '# likes'})})`
          : l`Like (${plural(count, {one: '# like', other: '# likes'})})`
      }
      onPress={event => {
        event.preventDefault()
        event.stopPropagation()
        requireAuth(toggle)
      }}>
      <PostControlButtonIcon icon={liked ? Liked : Like} />
      <PostControlButtonText>{formatCount(count)}</PostControlButtonText>
    </PostControlButton>
  )
}
