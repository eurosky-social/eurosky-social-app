import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {atoms as a} from '#/alf'
import {type app} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from '../config'
import {isMoment} from '../moments'
import {openMoment} from '../openMoment'
import {openWatching} from '../openWatching'
import {getOwnVideoEmbed} from '../record'
import {useVideoMoments} from '../useVideoMoments'
import {InsightsLink} from './InsightsLink'
import {MomentChips} from './MomentChips'

/**
 * Under a video post in its thread: the moments its replies are linked to.
 * With linked replies but no group big enough to be a moment, it offers to
 * watch the video with them instead, and its author gets a link to the
 * video's insights. Renders nothing for posts without a video or without
 * linked replies.
 */
export function ThreadMoments({
  items,
  videoPost,
}: {
  items: readonly ThreadItem[]
  videoPost: Pick<app.bsky.feed.defs.PostView, 'uri' | 'embed' | 'author'>
}) {
  const video = getOwnVideoEmbed(videoPost.embed)
  const hasVideo = !!video && video.presentation !== 'gif'
  const {t: l} = useLingui()
  const groups = useVideoMoments({
    videoPostUri: videoPost.uri,
    threadItems: items,
    enabled: hasVideo,
  })

  const moments = groups.filter(isMoment)

  if (!MEDIA_TIME_ENABLED || !hasVideo || groups.length === 0) return null

  return (
    <View style={[a.px_lg, a.pb_md]}>
      <MomentChips
        moments={moments}
        title={moments.length > 0 ? undefined : l`Comments along the video`}
        allLabel={moments.length > 0 ? undefined : l`Watch with comments`}
        onPressMoment={moment => openMoment(videoPost.uri, moment.startSeconds)}
        onPressAll={() => openWatching(videoPost.uri)}
      />
      <InsightsLink post={videoPost} style={[a.pt_sm]} />
    </View>
  )
}
