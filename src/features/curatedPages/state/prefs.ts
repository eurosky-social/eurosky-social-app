import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {z} from 'zod'

import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAgent, useSession} from '#/state/session'

/**
 * Collection NSID for the per-user curated pages preferences record, stored as
 * a singleton at rkey `self` (mirroring `social.mu.newsFeedPrefs`).
 */
export const CURATED_PAGES_PREFS_NSID = 'social.mu.curatedPagesPrefs'
const CURATED_PAGES_PREFS_RKEY = 'self'

/**
 * The reader's opt-in selections: which publishers they subscribe to. An empty
 * list (or absent record) means the reader has not subscribed to anything yet.
 */
export const curatedPagesPrefsSchema = z.object({
  subscribedPublisherIds: z.array(z.string()),
  createdAt: z.string(),
})
export type CuratedPagesPrefs = z.infer<typeof curatedPagesPrefsSchema>

export function makeDefaultCuratedPagesPrefs(): CuratedPagesPrefs {
  return {
    subscribedPublisherIds: [],
    createdAt: new Date().toISOString(),
  }
}

const curatedPagesPrefsQueryKeyRoot = 'curatedPagesPrefs'
export const createCuratedPagesPrefsQueryKey = (args: {did?: string}) =>
  createQueryKey(curatedPagesPrefsQueryKeyRoot, args)

/**
 * Reads the current user's curated pages prefs record. Returns `null` when the
 * record does not exist yet (i.e. the reader has not subscribed to anything).
 */
export function useCuratedPagesPrefsQuery() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useQuery<CuratedPagesPrefs | null>({
    queryKey: createCuratedPagesPrefsQueryKey({did}),
    staleTime: STALE.MINUTES.ONE,
    enabled: !!did,
    queryFn: async () => {
      try {
        const res = await agent.com.atproto.repo.getRecord({
          repo: did!,
          collection: CURATED_PAGES_PREFS_NSID,
          rkey: CURATED_PAGES_PREFS_RKEY,
        })
        const parsed = curatedPagesPrefsSchema.safeParse(res.data.value)
        if (!parsed.success) {
          logger.error('curatedPagesPrefs: record failed validation', {
            safeMessage: parsed.error.message,
          })
          return null
        }
        return parsed.data
      } catch (e) {
        if (
          e instanceof Error &&
          e.message.includes('Could not locate record:')
        ) {
          return null
        }
        throw e
      }
    },
  })
}

export function useCuratedPagesPrefsMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<void, unknown, CuratedPagesPrefs>({
    mutationFn: async prefs => {
      if (!currentAccount) throw new Error('Not signed in')
      await agent.com.atproto.repo.putRecord({
        repo: currentAccount.did,
        collection: CURATED_PAGES_PREFS_NSID,
        rkey: CURATED_PAGES_PREFS_RKEY,
        validate: false,
        record: {
          $type: CURATED_PAGES_PREFS_NSID,
          ...prefs,
        },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: createCuratedPagesPrefsQueryKey({did: currentAccount?.did}),
      })
    },
    onError: error => {
      logger.error('curatedPagesPrefs: failed to save', {safeMessage: error})
    },
  })
}

/**
 * Toggles a publisher into or out of the reader's subscription list, creating
 * the record on first subscribe.
 */
export function useToggleCuratedSubscription() {
  const {data: prefs} = useCuratedPagesPrefsQuery()
  const {mutateAsync: savePrefs} = useCuratedPagesPrefsMutation()

  return async (publisherId: string) => {
    const base = prefs ?? makeDefaultCuratedPagesPrefs()
    const subscribed = base.subscribedPublisherIds.includes(publisherId)
    const subscribedPublisherIds = subscribed
      ? base.subscribedPublisherIds.filter(id => id !== publisherId)
      : [...base.subscribedPublisherIds, publisherId]
    await savePrefs({...base, subscribedPublisherIds})
  }
}
