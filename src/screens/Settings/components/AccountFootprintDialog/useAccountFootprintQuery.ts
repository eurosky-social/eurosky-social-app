import {fetch} from 'expo/fetch'
import {useQuery} from '@tanstack/react-query'

import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {com} from '#/lexicons'
import {countRepoRecords} from './countRepoRecords'
import {downloadRepoCar} from './downloadRepoCar'
import {groupByService, type ServiceFootprint} from './services'

const accountFootprintQueryKeyRoot = 'account-footprint'
const accountBlobCountQueryKeyRoot = 'account-blob-count'
const BLOB_PAGE_SIZE = 1000

export type AccountFootprint = {
  services: ServiceFootprint[]
  /** False when the repo was too large to count, so only names are known. */
  counted: boolean
}

/**
 * Exact record counts per service, from one download of the account's repo.
 * atproto has no count endpoint, and paging listRecords per collection takes
 * hundreds of requests on an active account. Repos over the download cap, or
 * whose download fails, fall back to describeRepo's collection names.
 */
export function useAccountFootprintQuery() {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const pdsUrl = currentAccount?.pdsUrl

  return useQuery({
    enabled: !!did,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createQueryKey(accountFootprintQueryKeyRoot, {did}),
    queryFn: async ({signal}): Promise<AccountFootprint> => {
      let car: Uint8Array | null = null
      if (pdsUrl) {
        try {
          car = await downloadRepoCar(fetch, {pdsUrl, did: did!, signal})
        } catch (error) {
          if (signal.aborted) throw error
          logger.warn('useAccountFootprintQuery: getRepo failed', {
            safeMessage: error,
          })
        }
      }
      if (car) {
        const counts = await countRepoRecords(car)
        return {
          counted: true,
          services: groupByService(
            [...counts].map(([nsid, count]) => ({nsid, count})),
          ),
        }
      }

      const {collections} = await client.call(
        com.atproto.repo.describeRepo,
        {repo: did!},
        {signal},
      )
      return {
        counted: false,
        services: groupByService(collections.map(nsid => ({nsid, count: 0}))),
      }
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
    queryFn: async ({signal}) => {
      let count = 0
      let cursor: string | undefined
      do {
        const page = await client.call(
          com.atproto.sync.listBlobs,
          {did: did!, limit: BLOB_PAGE_SIZE, cursor},
          {validateResponse: false, strictResponseProcessing: false, signal},
        )
        count += page.cids.length
        // Some hosts send a cursor even on the last page.
        cursor = page.cids.length === BLOB_PAGE_SIZE ? page.cursor : undefined
      } while (cursor)
      return count
    },
  })
}
