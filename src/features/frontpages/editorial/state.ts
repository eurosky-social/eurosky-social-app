import {type AtUriString, type DidString} from '@atproto/syntax'
import {moderatePost} from '@bsky/sdk/moderation'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {createServiceClient} from '#/lib/lexClient'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {type FeedPostSliceItem} from '#/state/queries/post-feed'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {articleFromPost} from './articles'
import {type Curation} from './curation'
import {type CurationSnapshot, readCuration, saveCuration} from './records'

const editorialCurationQueryKey = (did: string) =>
  createQueryKey('editorialCuration', {did})

/** Published curation is public and belongs to the publisher, not the reader's preferences. */
export function useEditorialCurationQuery(did: DidString, enabled = true) {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  return useQuery({
    queryKey: editorialCurationQueryKey(did),
    staleTime: STALE.MINUTES.ONE,
    enabled,
    async queryFn() {
      if (currentAccount?.did === did) return readCuration(pdsClient, did)
      const {pds} = await resolveDidAndPds(did)
      return readCuration(createServiceClient(pds), did)
    },
  })
}

/** Public discovery is used only for the automatic, unpublished front page. */
export function useEditorialStarterPacksQuery(
  did: DidString,
  enabled: boolean,
) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  return useQuery({
    queryKey: createQueryKey('editorialStarterPacks', {
      did,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    enabled,
    retry: 1,
    queryFn: () =>
      client.call(app.bsky.graph.getActorStarterPacks, {actor: did, limit: 10}),
  })
}

export function useSaveEditorialCurationMutation(did: DidString) {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      source,
      curation,
    }: {
      source: CurationSnapshot
      curation: Curation
    }) => saveCuration(pdsClient, did, source, curation),
    onSuccess(snapshot) {
      queryClient.setQueryData(editorialCurationQueryKey(did), snapshot)
    },
  })
}

/** Saved picks must remain visible even after they leave the first author-feed page. */
export function useEditorialPostsQuery(
  did: string,
  uris: string[],
  enabled: boolean,
) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const moderationOpts = useModerationOpts()
  const queries = useQueries({
    queries: chunk([...new Set(uris)].sort(), 25).map(batch => ({
      queryKey: createQueryKey('editorialPosts', {
        uris: batch,
        viewer: currentAccount?.did,
      }),
      staleTime: STALE.MINUTES.ONE,
      enabled: enabled && !!moderationOpts,
      queryFn: async () =>
        (
          await client.call(app.bsky.feed.getPosts, {
            uris: batch as AtUriString[],
          })
        ).posts,
    })),
  })
  const articles = queries.flatMap(query =>
    (query.data ?? []).flatMap(post => {
      if (
        !moderationOpts ||
        post.author.did !== did ||
        !bsky.matches(app.bsky.feed.post, post.record) ||
        post.record.reply
      )
        return []
      const moderation = moderatePost(post, moderationOpts)
      if (moderation.ui('contentList').filter) return []
      const item: FeedPostSliceItem = {
        _reactKey: post.uri,
        uri: post.uri,
        post,
        record: post.record,
        moderation,
      }
      return [articleFromPost(item)]
    }),
  )
  return {
    articles,
    isPending: queries.some(query => query.isPending),
    isError: queries.some(query => query.isError),
    refetch: () => Promise.all(queries.map(query => query.refetch())),
  }
}
