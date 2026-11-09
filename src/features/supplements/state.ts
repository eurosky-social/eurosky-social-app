import {type Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {createServiceClient} from '#/lib/lexClient'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {resolveDidAndPds} from '#/state/session/resolve-pds'
import {
  deleteSupplement,
  listSupplements,
  readSupplement,
  saveSupplement,
  type StoredSupplement,
} from './records'
import {type Supplement} from './supplement'

const listKey = (did: string) => createQueryKey('supplements', {did})
const oneKey = (did: string, rkey: string) =>
  createQueryKey('supplement', {did, rkey})

/** A supplement is read from its editor's PDS, not from the reader's. */
function useReadClient() {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  return async (did: DidString): Promise<Client> => {
    if (currentAccount?.did === did) return pdsClient
    const {pds} = await resolveDidAndPds(did)
    return createServiceClient(pds)
  }
}

/** Every account's supplements. One editor's failure leaves the others. */
export function useSupplementsQueries(dids: string[]) {
  const readClient = useReadClient()
  const results = useQueries({
    queries: dids.map(did => ({
      queryKey: listKey(did),
      staleTime: STALE.MINUTES.ONE,
      queryFn: async () =>
        listSupplements(await readClient(did as DidString), did as DidString),
    })),
  })
  return {
    supplements: results.flatMap(result => result.data ?? []),
    isLoading: results.some(result => result.isLoading),
    isError: results.length > 0 && results.every(result => result.isError),
    refetch: () => Promise.all(results.map(result => result.refetch())),
  }
}

export function useSupplementQuery(did: string | undefined, rkey: string) {
  const readClient = useReadClient()
  return useQuery({
    queryKey: oneKey(did ?? '', rkey),
    staleTime: STALE.MINUTES.ONE,
    enabled: !!did,
    queryFn: async () =>
      readSupplement(
        await readClient(did as DidString),
        did as DidString,
        rkey,
      ),
  })
}

export function useSaveSupplementMutation(did: DidString) {
  const client = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      source,
      supplement,
    }: {
      source?: StoredSupplement
      supplement: Supplement
    }) => saveSupplement(client, did, source, supplement),
    onSuccess(saved) {
      queryClient.setQueryData(oneKey(did, saved.rkey), saved)
      void queryClient.invalidateQueries({queryKey: listKey(did)})
    },
    /*
     * After a conflict the page keeps the draft but will not publish it;
     * discarding it then edits the other editor's version, not this stale one.
     */
    onError(_, {source}) {
      if (source)
        void queryClient.invalidateQueries({
          queryKey: oneKey(did, source.rkey),
        })
    },
  })
}

export function useDeleteSupplementMutation(did: DidString) {
  const client = usePdsClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (source: StoredSupplement) =>
      deleteSupplement(client, did, source),
    onSuccess(_, source) {
      queryClient.removeQueries({queryKey: oneKey(did, source.rkey)})
      void queryClient.invalidateQueries({queryKey: listKey(did)})
    },
  })
}
