import {View} from 'react-native'

import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {atoms as a} from '#/alf'
import {type app} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from '../config'
import {getOwnVideoEmbed} from '../record'
import {useJumpToMediaTime} from '../useJumpToMediaTime'
import {useVideoMoments} from '../useVideoMoments'
import {MomentChips} from './MomentChips'

/**
 * Under a video post in its thread: the moments its replies are linked to.
 * Renders nothing for posts without a video or without linked replies.
 */
export function ThreadMoments({
  items,
  videoPost,
}: {
  items: readonly ThreadItem[]
  videoPost: Pick<app.bsky.feed.defs.PostView, 'uri' | 'embed'>
}) {
  const jump = useJumpToMediaTime()
  const video = getOwnVideoEmbed(videoPost.embed)
  const hasVideo = !!video && video.presentation !== 'gif'
  const moments = useVideoMoments({
    videoPostUri: videoPost.uri,
    threadItems: items,
    enabled: hasVideo,
  })

  if (!MEDIA_TIME_ENABLED || !hasVideo || moments.length === 0) return null

  return (
    <View style={[a.px_lg, a.pb_md]}>
      <MomentChips
        moments={moments}
        onPressMoment={moment => jump(videoPost.uri, moment.startSeconds)}
      />
    </View>
  )
}
