import {type Client} from '@atproto/lex'
import {useQueries, useQuery} from '@tanstack/react-query'
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
  type DutchOutletArticlesResponse,
  type DutchOutletsResponse,
  type DutchTheme,
  type DutchThemesResponse,
  type DutchThread,
  type DutchThreadResponse,
  type DutchThreadSort,
  type DutchThreadsResponse,
} from './types'
import {
  decodeDutchThreadView,
  type DutchThreadViewParams,
  dutchThreadViewParams,
  encodeDutchThreadView,
} from './view'

/**
 * How many threads the spread asks for. The page lays out a lead band plus
 * department bands; beyond this it is scrolling past the point anyone reads.
 */
export const THREADS_LIMIT = 40

export const createDutchThreadsQueryKey = (
  args: {
    scope: string
    theme?: string
    category?: string
    sort: DutchThreadSort
    limit: number
  } & DutchThreadViewParams,
) => createQueryKey('dutchThreads', args)

export const createDutchThreadQueryKey = (args: {
  id: string
  /** The view the thread is read in (see `encodeDutchThreadView`). */
  view?: string
}) => createQueryKey('dutchThread', args)

export const createDutchOutletsQueryKey = () =>
  createQueryKey('dutchOutlets', {})

export const createDutchOutletArticlesQueryKey = (args: {
  slug: string
  limit: number
}) => createQueryKey('dutchOutletArticles', args)

export const createDutchThemesQueryKey = (args: {
  scope: string
  category?: string
}) => createQueryKey('dutchThemes', args)

export const createDutchCategoriesQueryKey = (args: {
  scope: string
  theme?: string
}) => createQueryKey('dutchCategories', args)

/**
 * What narrows one read of `/api/threads`. Unset fields leave that facet open.
 * The service takes several countries and outlets at once but one theme and
 * one category, so a wider slice of the news is several of these.
 */
export type DutchThreadFilter = {
  theme?: string
  /** A label value: a province, e.g. `nl-utrecht`. */
  category?: string
  /** ISO country codes: threads one of their outlets covered. */
  countries?: string[]
  /** Outlet slugs: threads one of them covered. The rest are dropped. */
  outlets?: string[]
  /**
   * Outlet slugs whose threads come first, and whose articles lead each event.
   * Nothing is dropped.
   */
  boost?: string[]
}

/**
 * The labeler's threads - the stories of its news view: already clustered,
 * themed, and carrying their coverage by outlet and country, so the page
 * neither clusters nor searches for posts itself. One read per filter, run
 * side by side; the results come back in the filters' order.
 *
 * Sorted by `burst`, the service's own ranking of what is news now, unless a
 * country is asked for, where `here` puts the threads its outlets covered most
 * first.
 */
export function useDutchThreadsQueries({
  scope = DUTCH_WORLD_SCOPE,
  filters,
  languages,
  limit = THREADS_LIMIT,
  enabled = true,
}: {
  /** Which of the labeler's scopes (feed selection and fit) to read. */
  scope?: string
  filters: DutchThreadFilter[]
  /**
   * ISO language codes: threads with an article in one, each showing only
   * those articles and with its lead in one of them as `leadIn`.
   */
  languages?: string[]
  limit?: number
  enabled?: boolean
}) {
  const pdsClient = useMaybePdsClient()
  const views = filters.map(filter => ({
    languages,
    countries: filter.countries,
    outlets: filter.outlets,
    boost: filter.boost,
  }))
  const results = useQueries({
    queries: views.map((view, index) => {
      const filter = filters[index]
      const viewParams = dutchThreadViewParams(view)
      const params = {
        scope,
        theme: filter.theme,
        category: filter.category,
        ...viewParams,
        sort: (viewParams.country ? 'here' : 'burst') as DutchThreadSort,
        limit,
      }
      return {
        queryKey: createDutchThreadsQueryKey(params),
        /*
         * The service refits hourly and articles trickle in between fits, so
         * there is nothing to gain from asking more often than the page is
         * likely to be reopened.
         */
        staleTime: STALE.MINUTES.FIVE,
        enabled: enabled && IS_DUTCH_API_CONFIGURED && !!pdsClient,
        async queryFn() {
          const url = buildDutchApiUrl('/api/threads', params)
          try {
            return await fetchDutchApi<DutchThreadsResponse>(pdsClient!, url)
          } catch (error) {
            /* The page only says it could not load; this says why. */
            logger.error('dutchThreads: failed to load', {safeMessage: error})
            throw error
          }
        },
      }
    }),
  })

  return {
    /** One list per filter, each in the service's order. */
    threadLists: results.map(
      result => result.data?.threads ?? ([] as DutchThread[]),
    ),
    /** The view each list was read in, for its threads to be read again in. */
    views: views.map(encodeDutchThreadView),
    isLoading: results.some(result => result.isLoading),
    /* Some of a slice is still worth showing; only none of it is an error. */
    error:
      results.length > 0 && results.every(result => result.error)
        ? results[0].error
        : null,
  }
}

/**
 * One thread with every event in full. The list trims each event to a few
 * articles; this is the whole coverage, for the article page.
 *
 * `id` is the one `threadStoryId` built: the thread's key, which outlives
 * refits, and the scope whose fit it is in. `view` is the one the list read it
 * in, so the page shows the articles the story was picked for.
 */
export function useDutchThreadQuery({
  id,
  view,
  enabled = true,
}: {
  id?: string
  /** From `encodeDutchThreadView`. */
  view?: string
  enabled?: boolean
}) {
  const pdsClient = useMaybePdsClient()
  const ref = id ? parseThreadStoryId(id) : undefined
  return useQuery({
    queryKey: createDutchThreadQueryKey({id: id ?? '', view}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && !!ref && IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchThreadResponse>(
        pdsClient!,
        buildDutchApiUrl(`/api/threads/${encodeURIComponent(ref!.key)}`, {
          scope: ref!.scope,
          ...decodeDutchThreadView(view),
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
 * A theme's name by its slug. Until the themes load, or for a slug the
 * service no longer serves, the slug stands in, as the service does itself.
 */
export function useThemeName(): (slug: string) => string {
  const {themes} = useDutchThemesQuery()
  const names = new Map(themes.map(theme => [theme.slug, theme.name]))
  return slug => names.get(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

/**
 * Every outlet the service reads, for the news settings to pick from. Sorted
 * by country then slug, as the service sends them.
 */
export function useDutchOutletsQuery({
  enabled = true,
}: {enabled?: boolean} = {}) {
  const pdsClient = useMaybePdsClient()
  const query = useQuery({
    queryKey: createDutchOutletsQueryKey(),
    /* Outlets are added by hand, on the order of days. */
    staleTime: STALE.HOURS.ONE,
    enabled: enabled && IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      try {
        const data = await fetchDutchApi<DutchOutletsResponse>(
          pdsClient!,
          buildDutchApiUrl('/api/outlets'),
        )
        return data.outlets
      } catch (error) {
        logger.error('dutchOutlets: failed to load', {safeMessage: error})
        throw error
      }
    },
  })

  return {
    /** Undefined until loaded, so a caller can tell none from not yet. */
    outlets: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

/** How many of an outlet's articles its newsroom front page shows. */
export const OUTLET_ARTICLES_LIMIT = 20

/**
 * An outlet's own articles, latest first: its newsroom's front page, as the
 * service ingested them from its feeds, so the app fetches no RSS itself.
 */
export function useDutchOutletArticlesQuery({
  slug,
  limit = OUTLET_ARTICLES_LIMIT,
  enabled = true,
}: {
  slug?: string
  limit?: number
  enabled?: boolean
}) {
  const pdsClient = useMaybePdsClient()
  return useQuery({
    queryKey: createDutchOutletArticlesQueryKey({slug: slug ?? '', limit}),
    /* Feeds are polled every few minutes; the page need not chase them. */
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && !!slug && IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      try {
        const data = await fetchDutchApi<DutchOutletArticlesResponse>(
          pdsClient!,
          buildDutchApiUrl(
            `/api/outlets/${encodeURIComponent(slug!)}/articles`,
            {limit},
          ),
        )
        return data.articles
      } catch (error) {
        logger.error('dutchOutletArticles: failed to load', {
          safeMessage: error,
        })
        throw error
      }
    },
  })
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
