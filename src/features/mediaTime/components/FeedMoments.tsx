import {View} from 'react-native'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {type app} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from '../config'
import {canShowFeedMoments} from '../feed'
import {topMoments, useMomentSummary} from '../momentSummaries'
import {openMoment} from '../openMoment'
import {MomentChips} from './MomentChips'

/**
 * Under a video post in a feed: its most talked-about moments. Renders
 * nothing for posts without a video, without replies, or whose content is
 * hidden behind a warning.
 */
export function FeedMoments({
  post,
  moderation,
}: {
  post: Pick<app.bsky.feed.defs.PostView, 'uri' | 'embed' | 'replyCount'>
  moderation: ModerationDecision
}) {
  const {t: l} = useLingui()
  const eligible = MEDIA_TIME_ENABLED && canShowFeedMoments(post, moderation)
  const {data: moments} = useMomentSummary({
    postUri: post.uri,
    enabled: eligible,
  })

  if (!eligible || !moments || moments.length === 0) return null

  return (
    <View style={[a.pt_xs, a.pb_sm]}>
      <MomentChips
        title={l`Most talked-about moments`}
        moments={topMoments(moments)}
        onPressMoment={moment => openMoment(post.uri, moment.startSeconds)}
      />
    </View>
  )
}
