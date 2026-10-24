import {type Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {updatePreferences} from '@bsky/sdk'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {z} from 'zod'

import {isRecordNotFoundError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {app, com} from '#/lexicons'
import {topicsAsThemes} from '../sources'

/**
 * `$type` of the news prefs in the account's private preferences
 * (`app.bsky.actor.putPreferences`), which only the account itself can read.
 *
 * Hacky: the PDS refuses preferences outside the `app.bsky` namespace, so
 * this borrows Bluesky's. The preferences union is open, so the PDS stores it
 * and other clients' preference writes carry it along, but Bluesky could start
 * rejecting or dropping unknown types there. Move it to a server of our own
 * before relying on it.
 */
export const NEWS_PREFS_TYPE = 'app.bsky.news.prefs'

/**
 * Where the prefs lived before: a public record, collection
 * `social.mu.newsFeedPrefs` at rkey `self`. Read as a fallback until the
 * reader next saves, which deletes it. The legacy screens still use it.
 */
export const NEWS_FEED_PREFS_NSID = 'social.mu.newsFeedPrefs'
const NEWS_FEED_PREFS_RKEY = 'self'

type Preference = app.bsky.actor.defs.Preferences[number]

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
  /**
   * Whether the outlets left in are the only ones shown. Otherwise their
   * stories and articles come first, and the others still show. Came later
   * than the rest, so an interest without it boosts.
   */
  strictOutlets: z.boolean().default(false),
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
 * Reads the current user's news prefs from their private preferences, else
 * from the public record they were kept in before. Returns `null` when there
 * are none (i.e. the user has not set up the news feed).
 */
export function useNewsFeedPrefsQuery() {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did

  return useQuery<NewsFeedPrefs | null>({
    queryKey: createNewsFeedPrefsQueryKey({did}),
    staleTime: STALE.MINUTES.ONE,
    enabled: !!did,
    queryFn: () => readNewsFeedPrefs(pdsClient, did!),
  })
}

export async function readNewsFeedPrefs(
  pdsClient: Client,
  did: DidString,
): Promise<NewsFeedPrefs | null> {
  // `service: null`, like the SDK's preference helpers: preferences live on
  // the account host, so the call must not be proxied to an AppView.
  const {preferences} = await pdsClient.call(
    app.bsky.actor.getPreferences,
    {},
    {service: null},
  )
  const stored = preferences.find(pref => pref.$type === NEWS_PREFS_TYPE)
  if (stored) return parseNewsFeedPrefs(stored, 'preference')
  return readLegacyRecord(pdsClient, did)
}

async function readLegacyRecord(
  pdsClient: Client,
  did: DidString,
): Promise<NewsFeedPrefs | null> {
  try {
    const data = await pdsClient.call(com.atproto.repo.getRecord, {
      repo: did,
      collection: NEWS_FEED_PREFS_NSID,
      rkey: NEWS_FEED_PREFS_RKEY,
    })
    return parseNewsFeedPrefs(data.value, 'record')
  } catch (e) {
    if (isRecordNotFoundError(e)) return null
    throw e
  }
}

function parseNewsFeedPrefs(
  value: unknown,
  source: 'preference' | 'record',
): NewsFeedPrefs | null {
  const parsed = newsFeedPrefsSchema.safeParse(value)
  if (!parsed.success) {
    logger.error(`newsFeedPrefs: ${source} failed validation`, {
      safeMessage: parsed.error.message,
    })
    return null
  }
  return parsed.data
}

/**
 * Replaces the news prefs in the account's preferences (`null` removes them),
 * leaving every other preference as it is. The SDK serializes this with the
 * app's other preference writes on the same client, so none of them is lost.
 * Then deletes the public record the prefs were kept in before, if any.
 */
export async function writeNewsFeedPrefs(
  pdsClient: Client,
  did: DidString,
  prefs: NewsFeedPrefs | null,
) {
  // The union's member for unknown types is branded, so ours needs a cast.
  const item = {...prefs, $type: NEWS_PREFS_TYPE} as unknown as Preference
  await pdsClient.call(updatePreferences, current => [
    ...current.filter(pref => pref.$type !== NEWS_PREFS_TYPE),
    ...(prefs ? [item] : []),
  ])
  // A no-op on the PDS when there is no such record.
  await pdsClient.call(com.atproto.repo.deleteRecord, {
    repo: did,
    collection: NEWS_FEED_PREFS_NSID,
    rkey: NEWS_FEED_PREFS_RKEY,
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
      await writeNewsFeedPrefs(pdsClient, currentAccount.did, prefs)
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
      await writeNewsFeedPrefs(pdsClient, currentAccount.did, null)
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
