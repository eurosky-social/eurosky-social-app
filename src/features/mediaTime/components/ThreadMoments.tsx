import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {type app} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from '../config'
import {collectTimedReplies, groupIntoMoments} from '../moments'
import {getOwnVideoEmbed} from '../record'
import {useJumpToMediaTime} from '../useJumpToMediaTime'
import {MomentChips} from './MomentChips'

/**
 * Under a video post in its thread: the moments its replies are linked to.
 * Renders nothing for posts without a video or without linked replies.
 */
export function ThreadMoments({
  items,
  videoPost,
}: {
  items: Parameters<typeof collectTimedReplies>[0]
  videoPost: Pick<app.bsky.feed.defs.PostView, 'uri' | 'embed'>
}) {
  const jump = useJumpToMediaTime()

  if (!MEDIA_TIME_ENABLED) return null
  const video = getOwnVideoEmbed(videoPost.embed)
  if (!video || video.presentation === 'gif') return null
  const moments = groupIntoMoments(collectTimedReplies(items, videoPost.uri))
  if (moments.length === 0) return null

  return (
    <View style={[a.px_lg, a.pb_md]}>
      <MomentChips
        moments={moments}
        onPressMoment={moment => jump(videoPost.uri, moment.startSeconds)}
      />
    </View>
  )
}
