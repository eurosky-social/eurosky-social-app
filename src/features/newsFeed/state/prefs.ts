import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {z} from 'zod'

import {isRecordNotFoundError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {com} from '#/lexicons'
import {topicsAsThemes} from '../sources'

/**
 * Collection NSID for the per-user news feed preferences record, stored as a
 * singleton at rkey `self` (mirroring `app.bsky.actor.profile`).
 */
export const NEWS_FEED_PREFS_NSID = 'social.mu.newsFeedPrefs'
const NEWS_FEED_PREFS_RKEY = 'self'

/**
 * One of the reader's interests on the news page: a slice of the news by
 * place, theme and outlet, shown as its own tab. Every filter is optional, and
 * an empty one leaves that facet open.
 */
export const newsInterestSchema = z.object({
  /** Random, stable across edits: what the page remembers a tab by. */
  id: z.string(),
  /**
   * Not set from the settings yet: tabs are named after their places (see
   * `useInterestTitle`). Kept so a name can come back without a migration.
   */
  name: z.string(),
  /** ISO 3166-1 alpha-2 codes, lower case, as the news aggregator uses. */
  countries: z.array(z.string()),
  /**
   * Places inside the countries, as the aggregator's label values (e.g.
   * `nl-utrecht`). Picking any narrows their country to just those.
   */
  subLocations: z.array(z.string()),
  /** The aggregator's theme slugs, e.g. `tech`. */
  themes: z.array(z.string()),
  /**
   * Outlet slugs left out. Every outlet of the interest's places is in until
   * the reader unticks it, so outlets added later join by default.
   */
  excludedOutlets: z.array(z.string()),
})
export type NewsInterest = z.infer<typeof newsInterestSchema>

/**
 * Empty `topics` means setup is unfinished (callers show the topic picker).
 * Empty `regions` means no region filter, and empty `languages` no language
 * filter. `languages` and `interests` came later than the rest, so a record
 * without them reads as having none rather than failing validation.
 *
 * The news feed reads `topics`, `regions`, `languages` and `excludedDids`;
 * the news page reads `interests`, and the app's content languages.
 */
export const newsFeedPrefsSchema = z.object({
  /** The news aggregator's theme slugs, or `ALL_TOPICS`. */
  topics: z.array(z.string()).transform(topicsAsThemes),
  regions: z.array(z.string()),
  /** ISO 639-1 codes, e.g. `en`: the languages of the news to show. */
  languages: z.array(z.string()).default([]),
  excludedDids: z.array(z.string()),
  /** The news page's tabs, in the reader's order. */
  interests: z.array(newsInterestSchema).default([]),
  createdAt: z.string(),
})
export type NewsFeedPrefs = z.infer<typeof newsFeedPrefsSchema>

export function makeDefaultNewsFeedPrefs(): NewsFeedPrefs {
  return {
    topics: [],
    regions: [],
    languages: [],
    excludedDids: [],
    interests: [],
    createdAt: new Date().toISOString(),
  }
}

const newsFeedPrefsQueryKeyRoot = 'newsFeedPrefs'
export const createNewsFeedPrefsQueryKey = (args: {did?: string}) =>
  createQueryKey(newsFeedPrefsQueryKeyRoot, args)

/**
 * Reads the current user's news feed prefs record. Returns `null` when the
 * record does not exist yet (i.e. the user has not set up the news feed).
 */
export function useNewsFeedPrefsQuery() {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useQuery<NewsFeedPrefs | null>({
    queryKey: createNewsFeedPrefsQueryKey({did}),
    staleTime: STALE.MINUTES.ONE,
    enabled: !!did,
    queryFn: async () => {
      try {
        const data = await pdsClient.call(com.atproto.repo.getRecord, {
          repo: did!,
          collection: NEWS_FEED_PREFS_NSID,
          rkey: NEWS_FEED_PREFS_RKEY,
        })
        const parsed = newsFeedPrefsSchema.safeParse(data.value)
        if (!parsed.success) {
          logger.error('newsFeedPrefs: record failed validation', {
            safeMessage: parsed.error.message,
          })
          return null
        }
        return parsed.data
      } catch (e) {
        if (isRecordNotFoundError(e)) return null
        throw e
      }
    },
  })
}

export function useNewsFeedPrefsMutation() {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  const queryKey = createNewsFeedPrefsQueryKey({did: currentAccount?.did})

  return useMutation<
    void,
    unknown,
    NewsFeedPrefs,
    {previous: NewsFeedPrefs | null | undefined}
  >({
    mutationFn: async prefs => {
      if (!currentAccount) throw new Error('Not signed in')
      await pdsClient.call(com.atproto.repo.putRecord, {
        repo: currentAccount.did,
        collection: NEWS_FEED_PREFS_NSID,
        rkey: NEWS_FEED_PREFS_RKEY,
        validate: false,
        record: {
          $type: NEWS_FEED_PREFS_NSID,
          ...prefs,
        },
      })
    },
    // Optimistic: the UI updates on tap and rolls back if the PDS write fails.
    onMutate: async prefs => {
      await queryClient.cancelQueries({queryKey})
      const previous = queryClient.getQueryData<NewsFeedPrefs | null>(queryKey)
      queryClient.setQueryData(queryKey, prefs)
      return {previous}
    },
    onError: (error, _prefs, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
      logger.error('newsFeedPrefs: failed to save', {safeMessage: error})
    },
    onSettled: () => {
      void queryClient.invalidateQueries({queryKey})
    },
  })
}

export function useNewsFeedPrefsDeleteMutation() {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation({
    mutationFn: async () => {
      if (!currentAccount) throw new Error('Not signed in')
      await pdsClient.call(com.atproto.repo.deleteRecord, {
        repo: currentAccount.did,
        collection: NEWS_FEED_PREFS_NSID,
        rkey: NEWS_FEED_PREFS_RKEY,
      })
    },
    onMutate: () => {
      // Optimistically clear so the UI returns to the unconfigured state
      // without waiting for the network round-trip.
      queryClient.setQueryData(
        createNewsFeedPrefsQueryKey({did: currentAccount?.did}),
        null,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: createNewsFeedPrefsQueryKey({did: currentAccount?.did}),
      })
    },
    onError: error => {
      logger.error('newsFeedPrefs: failed to delete', {safeMessage: error})
    },
  })
}
