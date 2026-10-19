import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {EVENT_POSTS_SHOWN} from '../config'
import {useEventPostsQuery, usePrecacheEvent} from '../queries'
import {type EventProfile, type EventRecord} from '../types'
import {getEventShareUrls, hideEventLinks, makeEventLink} from '../util'
import {EventFeedItemPost} from './EventFeedItemPost'

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
  const eventUrls = getEventShareUrls(event, profile)

  if (!posts.length) return null

  /*
   * Indented to line up with the event's content, so the posts read as part of
   * the event. The tinted gutter fills the gap. The wrapper draws the first
   * border, so it spans the gutter too.
   */
  return (
    <View
      style={[
        a.pl_xl,
        a.border_t,
        t.atoms.bg_contrast_25,
        t.atoms.border_contrast_low,
      ]}>
      {posts.map((post, i) => (
        <EventFeedItemPost
          key={post.uri}
          post={hideEventLinks(post, eventUrls)}
          hideTopBorder={i === 0}
          style={[a.border_l, t.atoms.bg, t.atoms.border_contrast_low]}
        />
      ))}
      {hasNextPage && (
        <Link
          to={makeEventLink(event)}
          label={l`Show more posts about this event`}
          onPress={() => precacheEvent(event, profile)}
          style={[
            a.px_xl,
            a.py_md,
            a.border_t,
            a.border_l,
            t.atoms.bg,
            t.atoms.border_contrast_low,
          ]}>
          {({hovered}) => (
            <Text
              style={[
                t.atoms.text_link,
                hovered && {textDecorationLine: 'underline'},
              ]}>
              <Trans>Show more posts about this event</Trans>
            </Text>
          )}
        </Link>
      )}
    </View>
  )
}
