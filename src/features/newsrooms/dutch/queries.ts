import {type Client} from '@atproto/lex'
import {useQuery} from '@tanstack/react-query'
import {jwtDecode} from 'jwt-decode'

import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useMaybePdsClient} from '#/state/session'
import {com} from '#/lexicons'
import {parseThreadStoryId} from './adapt'
import {
  buildDutchApiUrl,
  DUTCH_API_LXM,
  DUTCH_API_SERVICE_DID,
  DUTCH_WORLD_SCOPE,
  IS_DUTCH_API_CONFIGURED,
} from './config'
import {
  type DutchCategoriesResponse,
  type DutchCategory,
  type DutchTheme,
  type DutchThemesResponse,
  type DutchThread,
  type DutchThreadResponse,
  type DutchThreadSort,
  type DutchThreadsResponse,
} from './types'

/**
 * How many threads the spread asks for. The page lays out a lead band plus
 * department bands; beyond this it is scrolling past the point anyone reads.
 */
export const THREADS_LIMIT = 40

export const createDutchThreadsQueryKey = (args: {
  scope: string
  theme?: string
  category?: string
  country?: string
  lang?: string
  sort: DutchThreadSort
  limit: number
}) => createQueryKey('dutchThreads', args)

export const createDutchThreadQueryKey = (args: {id: string}) =>
  createQueryKey('dutchThread', args)

export const createDutchThemesQueryKey = (args: {
  scope: string
  category?: string
}) => createQueryKey('dutchThemes', args)

export const createDutchCategoriesQueryKey = (args: {
  scope: string
  theme?: string
}) => createQueryKey('dutchCategories', args)

/**
 * The labeler's threads - the stories of its news view: already clustered,
 * themed, and carrying their coverage by outlet and country, so the page
 * neither clusters nor searches for posts itself.
 *
 * Sorted by `burst`, the service's own ranking of what is news now, unless a
 * country is asked for, where `here` puts the threads its outlets covered most
 * first.
 */
export function useDutchThreadsQuery({
  scope = DUTCH_WORLD_SCOPE,
  theme,
  category,
  country,
  lang,
  limit = THREADS_LIMIT,
  enabled = true,
}: {
  /** Which of the labeler's scopes (feed selection and fit) to read. */
  scope?: string
  theme?: string
  /** A label value: a province, e.g. `nl-utrecht`. */
  category?: string
  /** An ISO country code: threads its outlets covered. */
  country?: string
  /**
   * An ISO language code: threads with an article in it, each with its lead
   * in that language as `leadIn`. The service takes one at a time.
   */
  lang?: string
  limit?: number
  enabled?: boolean
} = {}) {
  const pdsClient = useMaybePdsClient()
  const sort: DutchThreadSort = country ? 'here' : 'burst'
  const query = useQuery({
    queryKey: createDutchThreadsQueryKey({
      scope,
      theme,
      category,
      country,
      lang,
      sort,
      limit,
    }),
    /*
     * The service refits hourly and articles trickle in between fits, so
     * there is nothing to gain from asking more often than the page is likely
     * to be reopened.
     */
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const url = buildDutchApiUrl('/api/threads', {
        scope,
        theme,
        category,
        country,
        lang,
        sort,
        limit,
      })
      try {
        return await fetchDutchApi<DutchThreadsResponse>(pdsClient!, url)
      } catch (error) {
        /* The page only says it could not load; this says why. */
        logger.error('dutchThreads: failed to load', {safeMessage: error})
        throw error
      }
    },
  })

  return {
    threads: query.data?.threads ?? ([] as DutchThread[]),
    /** Null until the scope has been fitted; `threads` is then empty. */
    model: query.data?.model ?? null,
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * One thread with every event in full. The list trims each event to a few
 * articles; this is the whole coverage, for the article page.
 *
 * `id` is the one `threadStoryId` built: the thread's key, which outlives
 * refits, and the scope whose fit it is in.
 */
export function useDutchThreadQuery({
  id,
  enabled = true,
}: {
  id?: string
  enabled?: boolean
}) {
  const pdsClient = useMaybePdsClient()
  const ref = id ? parseThreadStoryId(id) : undefined
  return useQuery({
    queryKey: createDutchThreadQueryKey({id: id ?? ''}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && !!ref && IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchThreadResponse>(
        pdsClient!,
        buildDutchApiUrl(`/api/threads/${encodeURIComponent(ref!.key)}`, {
          scope: ref!.scope,
        }),
      )
      return data.thread
    },
  })
}

/**
 * The sections of the news, curated in the pipeline. These drive the spread's
 * departments, so the page has no section list of its own.
 */
export function useDutchThemesQuery({
  scope = DUTCH_WORLD_SCOPE,
  category,
  enabled = true,
}: {scope?: string; category?: string; enabled?: boolean} = {}) {
  const pdsClient = useMaybePdsClient()
  const query = useQuery({
    queryKey: createDutchThemesQueryKey({scope, category}),
    /*
     * Themes are curated rather than derived, so they change on the order of
     * pipeline releases, not of news.
     */
    staleTime: STALE.HOURS.ONE,
    enabled: enabled && IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchThemesResponse>(
        pdsClient!,
        buildDutchApiUrl('/api/themes', {scope, category}),
      )
      return data.themes
    },
  })

  return {
    themes: query.data ?? ([] as DutchTheme[]),
    isLoading: query.isLoading,
  }
}

/**
 * The label values stories can be filtered by: the language, then the
 * provinces. This is the axis the RSS spread has no equivalent for.
 */
export function useDutchCategoriesQuery({
  scope = DUTCH_WORLD_SCOPE,
  theme,
}: {scope?: string; theme?: string} = {}) {
  const pdsClient = useMaybePdsClient()
  const query = useQuery({
    queryKey: createDutchCategoriesQueryKey({scope, theme}),
    staleTime: STALE.HOURS.ONE,
    enabled: IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchCategoriesResponse>(
        pdsClient!,
        buildDutchApiUrl('/api/categories', {scope, theme}),
      )
      return data.categories
    },
  })

  return {
    categories: query.data ?? ([] as DutchCategory[]),
    isLoading: query.isLoading,
  }
}

/**
 * The share of a token's lifetime it is reused for. The rest is headroom, so a
 * reused token is still valid when the service checks it.
 */
const TOKEN_REUSE_SHARE = 0.5

/**
 * Lifetime assumed when a token's claims cannot be read: the PDS default for a
 * service-auth token with no requested `exp`.
 */
const DEFAULT_TOKEN_LIFETIME_MS = 60_000

/**
 * The account's current token, per client so switching accounts never reuses
 * another account's. `reuseUntil` is Infinity while the mint is in flight, so
 * the page's concurrent queries share one mint rather than racing three.
 */
const cachedTokens = new WeakMap<
  Client,
  {token: Promise<string>; reuseUntil: number}
>()

/**
 * A service-auth token for the labeler, shared across calls while it is fresh.
 *
 * `exp` is deliberately not passed: the PDS then derives both `iat` and `exp`
 * from its own clock, so the token cannot be invalidated by client clock skew
 * (the same reasoning as `ageAssurance/muAgeService`). Reuse keeps that
 * property: the lifetime is `exp - iat`, both PDS-clock, and is counted down on
 * the local clock from when the token arrived, never compared against it.
 */
function bearer(client: Client): Promise<string> {
  const cached = cachedTokens.get(client)
  if (cached && Date.now() < cached.reuseUntil) return cached.token

  const entry = {token: mintBearer(client), reuseUntil: Infinity}
  cachedTokens.set(client, entry)
  entry.token.then(
    token => {
      entry.reuseUntil = Date.now() + tokenLifetimeMs(token) * TOKEN_REUSE_SHARE
    },
    () => {
      if (cachedTokens.get(client) === entry) cachedTokens.delete(client)
    },
  )
  return entry.token
}

async function mintBearer(client: Client): Promise<string> {
  if (!DUTCH_API_SERVICE_DID) {
    throw new Error('Dutch API service DID is not configured')
  }
  const data = await client.call(com.atproto.server.getServiceAuth, {
    aud: DUTCH_API_SERVICE_DID,
    /* Only scope the token to a method where the service pins one. */
    ...(DUTCH_API_LXM ? {lxm: DUTCH_API_LXM} : {}),
  })
  return `Bearer ${data.token}`
}

/** How long the PDS made a token valid for, by its own clock. */
function tokenLifetimeMs(bearerToken: string): number {
  try {
    const {iat, exp} = jwtDecode(bearerToken.slice('Bearer '.length))
    if (iat !== undefined && exp !== undefined && exp > iat) {
      return (exp - iat) * 1000
    }
  } catch {}
  return DEFAULT_TOKEN_LIFETIME_MS
}

/**
 * One read of the consumer API, authenticated with an atproto service-auth JWT
 * (which works the same on OAuth and app-password sessions).
 *
 * A 401 is retried once with a freshly minted token, in case the reused one
 * was rejected (revoked, or the service's clock running ahead of the PDS's).
 *
 * Redirects are not followed. The API answers with JSON or an error status; a
 * redirect means a login proxy in front of it intercepted the request, and
 * following it would only surface later as a parse or CORS failure. See
 * ./README.md "Access".
 */
async function fetchDutchApi<T>(client: Client, url: string): Promise<T> {
  let res = await requestDutchApi(client, url)
  if (res.status === 401) {
    cachedTokens.delete(client)
    res = await requestDutchApi(client, url)
  }

  /*
   * `redirect: 'manual'` yields a readable 3xx on native but an opaque
   * response (type 'opaqueredirect', status 0) in the browser.
   */
  if (
    res.type === 'opaqueredirect' ||
    (res.status >= 300 && res.status < 400)
  ) {
    const location = res.headers.get('location')
    throw new Error(
      `Dutch API redirected ${url}${location ? ` to ${location}` : ''}; ` +
        `the endpoint is behind a login proxy rather than service-auth`,
    )
  }

  if (!res.ok) {
    throw new Error(`Dutch API ${res.status} for ${url}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    throw new Error(
      `Dutch API returned ${contentType || 'no content type'} for ${url}; ` +
        `the token was probably not accepted`,
    )
  }

  return (await res.json()) as T
}

async function requestDutchApi(client: Client, url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: await bearer(client),
    },
    redirect: 'manual',
  })
}
