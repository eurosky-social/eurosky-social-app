import {keepPreviousData, useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {useAppviewClient} from '#/state/session'
import {app} from '#/lexicons'
import {fetchMomentPosts, missingPostsRetryInterval} from './momentPosts'
import {momentPostsQueryKey} from './queryKeys'

/** The posts of a moment's comments, from the viewer's AppView. */
export function useMomentPosts(uris: readonly string[]) {
  const client = useAppviewClient()
  return useQuery({
    queryKey: momentPostsQueryKey(uris),
    enabled: uris.length > 0,
    staleTime: STALE.SECONDS.THIRTY,
    // keep showing the comments while a new one is added to the list
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchMomentPosts([...uris].sort(), async chunk => {
        const res = await client.call(app.bsky.feed.getPosts, {uris: chunk})
        return res.posts
      }),
    refetchInterval: query =>
      missingPostsRetryInterval(
        query.state.data,
        uris,
        query.state.dataUpdateCount,
      ),
  })
}
