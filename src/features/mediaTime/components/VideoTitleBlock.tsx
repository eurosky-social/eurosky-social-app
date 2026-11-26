import {View} from 'react-native'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {isMoment, type Moment} from '../moments'
import {getVideoTitle} from '../record'

/**
 * Under a video: its title (the first line of the post), who posted it and
 * when, and how many comments it has in how many moments.
 */
export function VideoTitleBlock({
  post,
  moderation,
  moments,
}: {
  post: app.bsky.feed.defs.PostView & {record: app.bsky.feed.post.Main}
  moderation: ModerationDecision
  moments: Moment[]
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const title = getVideoTitle(post.record.text)
  const author = sanitizeDisplayName(
    post.author.displayName || post.author.handle,
    moderation.ui('displayName'),
  )
  const total = moments.reduce((sum, m) => sum + m.count, 0)
  const momentCount = moments.filter(isMoment).length
  const counts =
    momentCount > 0
      ? l({
          message: `${plural(total, {one: '# comment', other: '# comments'})} in ${plural(momentCount, {one: '# moment', other: '# moments'})}`,
          comment:
            'Under a video: its comments linked to a second, and the moments they form, e.g. 412 comments in 6 moments',
        })
      : total > 0
        ? plural(total, {one: '# comment', other: '# comments'})
        : undefined
  return (
    <View style={[a.px_lg, a.pt_md, a.pb_md, a.gap_xs]}>
      {title ? (
        <Text
          emoji
          style={[a.text_lg, a.font_bold, a.leading_snug]}
          numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      <TimeElapsed timestamp={post.indexedAt}>
        {({timeElapsed}) => (
          <Text
            emoji
            style={[a.text_sm, t.atoms.text_contrast_medium]}
            numberOfLines={1}>
            {[author, timeElapsed, counts].filter(Boolean).join(' · ')}
          </Text>
        )}
      </TimeElapsed>
    </View>
  )
}
