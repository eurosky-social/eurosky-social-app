import {type AtUriString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {network} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from './config'
import {
  collectTimedReplies,
  groupIntoMoments,
  mergeMoments,
  type Moment,
  uniqueComments,
} from './moments'
import {getMomentsClient} from './momentsClient'
import {usePostedComments} from './postedComments'
import {momentsQueryKey} from './queryKeys'

export const RQKEY = momentsQueryKey

/** The moments of a video post, as the moments service groups them. */
export async function fetchMoments(videoPostUri: string): Promise<Moment[]> {
  const res = await getMomentsClient().call(network.eurosky.feed.getMoments, {
    uri: videoPostUri as AtUriString,
  })
  return res.moments.map(moment => ({
    startSeconds: moment.startSeconds,
    endSeconds: moment.endSeconds,
    count: moment.replyCount,
    comments: moment.replies.map(reply => ({
      uri: reply.uri,
      seconds: reply.seconds,
    })),
  }))
}

/**
 * The moments of a video post: from the moments service, which counts all of
 * the video's linked replies, plus linked replies it does not know yet: those
 * in `threadItems` and those this app just posted. Until it answers, or if
 * it fails, only those.
 */
export function useVideoMoments({
  videoPostUri,
  threadItems,
  enabled = true,
}: {
  videoPostUri: string
  threadItems: readonly ThreadItem[]
  enabled?: boolean
}): Moment[] {
  const {data} = useQuery({
    queryKey: RQKEY(videoPostUri),
    enabled: MEDIA_TIME_ENABLED && enabled,
    staleTime: STALE.SECONDS.THIRTY,
    retry: 1,
    queryFn: () => fetchMoments(videoPostUri),
  })
  const posted = usePostedComments(videoPostUri)
  const local = uniqueComments([
    ...collectTimedReplies(threadItems, videoPostUri),
    ...posted,
  ])
  return data ? mergeMoments(data, local) : groupIntoMoments(local)
}
