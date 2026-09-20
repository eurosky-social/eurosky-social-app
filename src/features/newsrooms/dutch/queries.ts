import {type Client} from '@atproto/lex'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useMaybePdsClient} from '#/state/session'
import {com} from '#/lexicons'
import {
  buildDutchApiUrl,
  DUTCH_API_LXM,
  DUTCH_API_SERVICE_DID,
  IS_DUTCH_API_CONFIGURED,
} from './config'
import {
  type DutchCategoriesResponse,
  type DutchCategory,
  type DutchStoriesResponse,
  type DutchStory,
  type DutchStorySort,
  type DutchTheme,
  type DutchThemesResponse,
} from './types'

/**
 * How many stories the spread asks for. The page lays out a lead band plus
 * department bands; beyond this it is scrolling past the point anyone reads.
 */
const STORIES_LIMIT = 40

export const createDutchStoriesQueryKey = (args: {
  theme?: string
  category?: string
  sort: DutchStorySort
}) => createQueryKey('dutchStories', args)

export const createDutchThemesQueryKey = (args: {category?: string}) =>
  createQueryKey('dutchThemes', args)

export const createDutchCategoriesQueryKey = (args: {theme?: string}) =>
  createQueryKey('dutchCategories', args)

/**
 * The labeler's stories: already clustered, themed, and carrying their matched
 * discussion, so the page neither clusters nor searches for posts itself.
 *
 * Defaults to `discussed`, since the spread is about what people are talking
 * about rather than what was published last.
 */
export function useDutchStoriesQuery({
  theme,
  category,
  sort = 'discussed',
}: {
  theme?: string
  category?: string
  sort?: DutchStorySort
} = {}) {
  const pdsClient = useMaybePdsClient()
  const query = useQuery({
    queryKey: createDutchStoriesQueryKey({theme, category, sort}),
    /*
     * The model refits every six hours and articles trickle in between fits,
     * so there is nothing to gain from asking more often than the page is
     * likely to be reopened.
     */
    staleTime: STALE.MINUTES.FIVE,
    enabled: IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchStoriesResponse>(
        pdsClient!,
        buildDutchApiUrl('/api/stories', {
          theme,
          category,
          sort,
          limit: STORIES_LIMIT,
        }),
      )
      return data
    },
  })

  return {
    stories: query.data?.stories ?? ([] as DutchStory[]),
    /** Null until a model has been fitted; `stories` is then empty. */
    model: query.data?.model ?? null,
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * The sections of the news, curated in the pipeline. These drive the spread's
 * departments, so the page has no section list of its own.
 */
export function useDutchThemesQuery({category}: {category?: string} = {}) {
  const pdsClient = useMaybePdsClient()
  const query = useQuery({
    queryKey: createDutchThemesQueryKey({category}),
    /*
     * Themes are curated rather than derived, so they change on the order of
     * pipeline releases, not of news.
     */
    staleTime: STALE.HOURS.ONE,
    enabled: IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchThemesResponse>(
        pdsClient!,
        buildDutchApiUrl('/api/themes', {category}),
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
export function useDutchCategoriesQuery({theme}: {theme?: string} = {}) {
  const pdsClient = useMaybePdsClient()
  const query = useQuery({
    queryKey: createDutchCategoriesQueryKey({theme}),
    staleTime: STALE.HOURS.ONE,
    enabled: IS_DUTCH_API_CONFIGURED && !!pdsClient,
    async queryFn() {
      const data = await fetchDutchApi<DutchCategoriesResponse>(
        pdsClient!,
        buildDutchApiUrl('/api/categories', {theme}),
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
 * A service-auth token for the labeler, minted per call.
 *
 * `exp` is deliberately not passed: the PDS then derives both `iat` and `exp`
 * from its own clock, so the token cannot be invalidated by client clock skew
 * (the same reasoning as `ageAssurance/muAgeService`). Tokens are short-lived,
 * so this is called immediately before each request rather than cached.
 */
async function bearer(client: Client): Promise<string> {
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

/**
 * One read of the consumer API, authenticated with an atproto service-auth JWT
 * (which works the same on OAuth and app-password sessions).
 *
 * Redirects are not followed. The API answers with JSON or an error status; a
 * redirect means a login proxy in front of it intercepted the request, and
 * following it would only surface later as a parse or CORS failure. See
 * ./README.md "Access".
 */
async function fetchDutchApi<T>(client: Client, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: await bearer(client),
    },
    redirect: 'manual',
  })

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
