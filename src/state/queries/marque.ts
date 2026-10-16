import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  checkAvailability,
  type CheckoutItem,
  type CheckoutResponse,
  createCheckout,
  findMarqueDomainForHandle,
  getMarqueDnsRecord,
  getOrder,
  getRequirements,
  ITEM_ACTIVE,
  listMarqueDomainRecords,
  listPricing,
  ORDER_ACTIVE,
  ORDER_FAILED,
  putDnsRecord,
  putDomainRecord,
  type Registrant,
  type TldPricing,
} from '#/lib/api/marque'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {usePdsClient, useSession} from '#/state/session'
import {IS_WEB} from '#/env'

const marqueQueryKeyRoot = 'marque'

function safeErrorShape(e: unknown) {
  if (!e || typeof e !== 'object') return String(e)
  const any = e as Record<string, unknown>
  const shape: Record<string, unknown> = {
    name: any.name,
    message: any.message,
    stack: typeof any.stack === 'string' ? '[stack]' : undefined,
    toString: typeof any.toString === 'function' ? '[fn]' : undefined,
    status: any.status,
    error: any.error,
    cause: any.cause ? safeErrorShape(any.cause) : undefined,
  }
  return shape
}

const pricingQueryKey = createKey('pricing')
const orderQueryKey = (orderId: string) => createKey('order', {orderId})
const searchQueryKey = (name: string, rankedTlds: string[]) =>
  createKey('search', {name, tlds: rankedTlds.join(',')})

/** Requirements for the selected registration domain. */
export function useMarqueRequirementsQuery(domain?: string) {
  const client = usePdsClient()
  return useQuery({
    queryKey: createKey('requirements', {domain: domain ?? ''}),
    queryFn: () => getRequirements(client, [domain!]).then(r => r.results[0]),
    enabled: !!domain,
    staleTime: STALE.MINUTES.FIVE,
  })
}

function createKey<T extends Record<string, unknown>>(
  suffix: string,
  args?: T,
) {
  return [marqueQueryKeyRoot, suffix, args ?? ({} as T)] as const
}

function checkoutCallbackUrls() {
  if (IS_WEB && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    return {
      successUrl: `${origin}/settings/account`,
      cancelUrl: `${origin}/settings/account`,
    }
  }
  return {
    successUrl: 'https://bsky.social/',
    cancelUrl: 'https://bsky.social/',
  }
}

/** List offered TLDs and standard pricing. */
export function useMarquePricingQuery() {
  const client = usePdsClient()
  return useQuery({
    queryKey: pricingQueryKey,
    queryFn: async () => {
      try {
        return await listPricing(client)
      } catch (error) {
        logger.error('marque: listPricing failed', {
          safeMessage: error instanceof Error ? error.message : String(error),
          raw: safeErrorShape(error),
        })
        throw error
      }
    },
    staleTime: STALE.MINUTES.THIRTY,
  })
}

/** Cross-check a handle against active `at.marque.domain` records. */
export function useMarqueManagedDomainQuery(handle?: string) {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const normalized = handle?.toLowerCase().replace(/^@/, '') ?? ''
  return useQuery({
    queryKey: createKey('managed-domain', {
      did: currentAccount?.did ?? '',
      handle: normalized,
    }),
    queryFn: () =>
      findMarqueDomainForHandle(client, currentAccount!.did, normalized),
    enabled: !!currentAccount?.did && !!normalized,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/** Active Marque-owned domains available for use as handles. */
export function useMarqueDomainsQuery() {
  const client = usePdsClient()
  const {currentAccount} = useSession()
  return useQuery({
    queryKey: createKey('domains', {did: currentAccount?.did ?? ''}),
    queryFn: async () => {
      const domains = await listMarqueDomainRecords(client, currentAccount!.did)
      return domains
        .filter(domain => domain.status === 'active')
        .sort((a, b) => a.domain.localeCompare(b.domain))
    },
    enabled: !!currentAccount?.did,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * Check live availability and pricing for a candidate domain. Debounced by the
 * caller (the input component controls when to call). Pass a single domain.
 */
export function useCheckAvailabilityMutation() {
  const client = usePdsClient()
  return useMutation({
    mutationFn: (domain: string) =>
      checkAvailability(client, [domain]).then(r => r.results[0] ?? null),
    onError(error) {
      logger.error('marque: checkAvailability failed', {
        safeMessage: error instanceof Error ? error.message : String(error),
        raw: safeErrorShape(error),
      })
    },
  })
}

// Match Marque's first-page/subsequent-page result counts.
const SEARCH_PAGE_ONE_SIZE = 15
const SEARCH_PAGE_SIZE = 10

function rankTlds(tlds: TldPricing[], requestedTld?: string): string[] {
  return [...tlds]
    .sort((a, b) => {
      if (requestedTld) {
        if (a.tld === requestedTld && b.tld !== requestedTld) return -1
        if (b.tld === requestedTld && a.tld !== requestedTld) return 1
      }
      if (!!a.popular !== !!b.popular) return a.popular ? -1 : 1
      return a.tld < b.tld ? -1 : a.tld > b.tld ? 1 : 0
    })
    .map(t => t.tld)
}

function pageOfTlds(
  ranked: string[],
  page: number,
): {tlds: string[]; next: number | undefined} {
  let slice: string[]
  let next: number | undefined
  if (page <= 1) {
    slice = ranked.slice(0, SEARCH_PAGE_ONE_SIZE)
    next = ranked.length > SEARCH_PAGE_ONE_SIZE ? 2 : undefined
  } else {
    const start = SEARCH_PAGE_ONE_SIZE + (page - 2) * SEARCH_PAGE_SIZE
    const end = start + SEARCH_PAGE_SIZE
    slice = ranked.slice(start, end)
    next = end < ranked.length ? page + 1 : undefined
  }
  return {tlds: slice, next}
}

export function useDomainSearchQuery(
  name: string,
  tlds: TldPricing[],
  opts?: {enabled?: boolean},
) {
  const client = usePdsClient()
  const {sld, requestedTld} = useMemo(() => {
    const raw = name.trim().toLowerCase().replace(/\s+/g, '')
    const dot = raw.indexOf('.')
    if (dot >= 0) {
      return {sld: raw.slice(0, dot), requestedTld: raw.slice(dot)}
    }
    return {sld: raw, requestedTld: undefined}
  }, [name])
  const ranked = useMemo(
    () => rankTlds(tlds, requestedTld),
    [tlds, requestedTld],
  )

  return useInfiniteQuery({
    queryKey: searchQueryKey(sld, ranked),
    queryFn: async ({pageParam}) => {
      const {tlds: pageTlds} = pageOfTlds(ranked, pageParam)
      const domains = pageTlds.map(tld => `${sld}${tld}`)
      try {
        return await checkAvailability(client, domains)
      } catch (error) {
        logger.error('marque: domain search failed', {
          safeMessage: error instanceof Error ? error.message : String(error),
          page: pageParam,
          raw: safeErrorShape(error),
        })
        throw error
      }
    },
    enabled: (opts?.enabled ?? true) && sld.length > 0,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const next = pageOfTlds(ranked, allPages.length + 1)
      return next.tlds.length > 0 ? allPages.length + 1 : undefined
    },
    staleTime: STALE.SECONDS.FIFTEEN,
  })
}

/** Validate an order and create a hosted payment checkout. */
export function useCreateCheckoutMutation() {
  const client = usePdsClient()
  return useMutation({
    mutationFn: (input: {
      items: CheckoutItem[]
      registrant: Registrant
      paymentMethod?: 'stripe' | 'paypal' | 'nowpayments'
    }): Promise<CheckoutResponse> => {
      const {successUrl, cancelUrl} = checkoutCallbackUrls()
      return createCheckout(client, {...input, successUrl, cancelUrl})
    },
  })
}

/**
 * Poll {@link getOrder} until the order reaches a terminal state
 * (`provisioned` / `failed`). Returns `null` until polling starts (no orderId).
 *
 * Polls every few seconds with backoff. The query is disabled when no orderId
 * is set, and stops automatically once a terminal state is reached.
 */
export function useOrderPollingQuery(orderId: string | null) {
  const client = usePdsClient()
  const [tick, setTick] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = useQuery({
    queryKey: orderQueryKey(orderId ?? ''),
    queryFn: () => getOrder(client, orderId!),
    enabled: !!orderId,
    staleTime: STALE.SECONDS.FIFTEEN,
  })

  useEffect(() => {
    if (!orderId) return
    const status = query.data?.status
    if (status === ORDER_ACTIVE || status === ORDER_FAILED) return

    const delay = tick < 5 ? 2_000 : 5_000
    timer.current = setTimeout(() => {
      setTick(t => t + 1)
      void query.refetch()
    }, delay)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [orderId, query, tick])

  return query
}

export function useFinalizeDomainPurchaseMutation(opts?: {
  onSuccess?: (domain: string) => void
  onError?: (error: Error) => void
}) {
  const client = usePdsClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation({
    mutationFn: async (input: {
      domain: string
      nameServers: string[]
      registeredAt?: string
      expiresAt?: string
    }) => {
      const did = currentAccount?.did
      if (!did) throw new Error('Not authenticated')

      const domainRef = await putDomainRecord(client, did, input.domain, {
        status: ITEM_ACTIVE,
        registeredAt: input.registeredAt,
        expiresAt: input.expiresAt,
        nameServers: input.nameServers,
      })

      if (input.nameServers.length > 0) {
        const existingDns = await getMarqueDnsRecord(client, did, input.domain)
        await putDnsRecord(
          client,
          did,
          input.domain,
          domainRef,
          existingDns?.records ?? [],
        )
      }
    },
    onSuccess(_data, variables) {
      void queryClient.invalidateQueries({queryKey: [marqueQueryKeyRoot]})
      opts?.onSuccess?.(variables.domain)
    },
    onError(error) {
      logger.error('marque: finalize purchase failed', {
        safeMessage: error instanceof Error ? error.message : String(error),
      })
      opts?.onError?.(error)
    },
  })
}

/** Invalidate all Marque-related queries. */
export function useInvalidateMarqueQueries() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({queryKey: [marqueQueryKeyRoot]}),
    [queryClient],
  )
}
