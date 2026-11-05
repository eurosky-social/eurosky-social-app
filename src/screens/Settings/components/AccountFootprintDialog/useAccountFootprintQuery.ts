import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {com} from '#/lexicons'
import {countRepoRecords} from './countRepoRecords'
import {groupByService} from './services'

const accountFootprintQueryKeyRoot = 'account-footprint'
const accountBlobCountQueryKeyRoot = 'account-blob-count'
const BLOB_PAGE_SIZE = 1000

/**
 * Exact record counts per service, from one download of the account's repo.
 * atproto has no count endpoint, and paging listRecords per collection takes
 * hundreds of requests on an active account.
 */
export function useAccountFootprintQuery() {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(accountFootprintQueryKeyRoot, {did}),
    queryFn: async () => {
      const car = await client.call(com.atproto.sync.getRepo, {did: did!})
      const counts = await countRepoRecords(car)
      return groupByService([...counts].map(([nsid, count]) => ({nsid, count})))
    },
  })
}

/**
 * How many photos, videos and other files the account has uploaded. The repo
 * only references these, so they're listed separately, and kept out of the
 * records query so a large upload history doesn't hold up the list.
 */
export function useAccountBlobCountQuery() {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(accountBlobCountQueryKeyRoot, {did}),
    queryFn: async () => {
      let count = 0
      let cursor: string | undefined
      do {
        const page = await client.call(
          com.atproto.sync.listBlobs,
          {did: did!, limit: BLOB_PAGE_SIZE, cursor},
          {validateResponse: false, strictResponseProcessing: false},
        )
        count += page.cids.length
        // Some hosts send a cursor even on the last page.
        cursor = page.cids.length === BLOB_PAGE_SIZE ? page.cursor : undefined
      } while (cursor)
      return count
    },
  })
}
