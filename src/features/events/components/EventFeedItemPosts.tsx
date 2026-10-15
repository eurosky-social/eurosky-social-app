import {Trans, useLingui} from '@lingui/react/macro'

import {Post} from '#/view/com/post/Post'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {EVENT_POSTS_SHOWN} from '../config'
import {useEventPostsQuery, usePrecacheEvent} from '../queries'
import {type EventProfile, type EventRecord} from '../types'
import {makeEventLink} from '../util'

/**
 * A few Bluesky posts that link to the event, shown under it in a feed. Each
 * opens its own thread; the rest are on the event's page.
 */
export function EventFeedItemPosts({
  event,
  profile,
}: {
  event: EventRecord
  profile?: EventProfile
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const precacheEvent = usePrecacheEvent()
  const {data, hasNextPage} = useEventPostsQuery({
    event,
    profile,
    pageSize: EVENT_POSTS_SHOWN,
  })
  const posts = data?.pages[0]?.posts ?? []

  if (!posts.length) return null

  return (
    <>
      {posts.map(post => (
        <Post key={post.uri} post={post} />
      ))}
      {hasNextPage && (
        <Link
          to={makeEventLink(event)}
          label={l`Show more posts about this event`}
          onPress={() => precacheEvent(event, profile)}
          style={[a.px_xl, a.py_md, a.border_t, t.atoms.border_contrast_low]}>
          {({hovered}) => (
            <Text
              style={[
                t.atoms.text_link,
                hovered && {textDecorationLine: 'underline'},
              ]}>
              <Trans>Show more posts</Trans>
            </Text>
          )}
        </Link>
      )}
    </>
  )
}
