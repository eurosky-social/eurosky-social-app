import {AtUri} from '@atproto/syntax'

import {makeProfileLink} from '#/lib/routes/links'
import {PostHider} from '#/components/moderation/PostHider'
import {ThreadItemAnchor} from './ThreadItemAnchor'

/** Keep an ancestor's original list/filter boundary around its article presentation. */
export function ThreadItemPublisher({
  item,
  ...props
}: React.ComponentProps<typeof ThreadItemAnchor>) {
  return (
    <PostHider
      href={makeProfileLink(
        item.value.post.author,
        'post',
        new AtUri(item.uri).rkey,
      )}
      disabled={false}
      iconSize={42}
      iconStyles={[]}
      profile={item.value.post.author}
      modui={item.moderation.ui('contentList')}
      interpretFilterAsBlur>
      <ThreadItemAnchor item={item} {...props} />
    </PostHider>
  )
}
