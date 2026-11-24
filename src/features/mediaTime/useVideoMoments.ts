import {type Client} from '@atproto/lex'
import {type AtUriString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {createServiceClient} from '#/lib/lexClient'
import {STALE} from '#/state/queries'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {network} from '#/lexicons'
import {MEDIA_TIME_ENABLED, MOMENTS_SERVICE_URL} from './config'
import {
  collectTimedReplies,
  groupIntoMoments,
  mergeMoments,
  type Moment,
} from './moments'

const RQKEY_ROOT = 'media-time-moments'
export const RQKEY = (videoPostUri: string) => [RQKEY_ROOT, videoPostUri]

let client: Client | undefined
function getClient() {
  client ??= createServiceClient(MOMENTS_SERVICE_URL)
  return client
}

/** The moments of a video post, as the moments service groups them. */
export async function fetchMoments(videoPostUri: string): Promise<Moment[]> {
  const res = await getClient().call(network.eurosky.feed.getMoments, {
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
 * the video's linked replies, plus linked replies in `threadItems` it does
 * not know yet. Until it answers, or if it fails, only the replies in
 * `threadItems`.
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
  const local = collectTimedReplies(threadItems, videoPostUri)
  return data ? mergeMoments(data, local) : groupIntoMoments(local)
}
