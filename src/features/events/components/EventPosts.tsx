import {moderatePost} from '@bsky/sdk/moderation'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {Post} from '#/view/com/post/Post'
import {EVENT_POSTS_SHOWN} from '../config'
import {useEventPostsQuery} from '../queries'
import {type EventProfile, type EventRecord} from '../types'

/**
 * A few Bluesky posts that link to the event. Each opens its own thread.
 */
export function EventPosts({
  event,
  profile,
}: {
  event: EventRecord
  profile?: EventProfile
}) {
  const moderationOpts = useModerationOpts()
  const {data: posts} = useEventPostsQuery({event, profile})

  if (!posts?.length || !moderationOpts) return null

  // Post blurs moderated content but still shows it; search hides it outright.
  const visiblePosts = posts
    .filter(
      post => !moderatePost(post, moderationOpts).ui('contentList').filter,
    )
    .slice(0, EVENT_POSTS_SHOWN)

  return (
    <>
      {visiblePosts.map(post => (
        <Post key={post.uri} post={post} />
      ))}
    </>
  )
}
