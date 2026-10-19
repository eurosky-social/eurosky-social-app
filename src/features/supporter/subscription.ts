import {type Client} from '@atproto/lex'
import {type NsidString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {BRAND} from '#/config/brand'
import {com} from '#/lexicons'

/* Keep the existing service NSIDs for deployed workers and OAuth clients. */
const GET_STATUS = 'social.mu.deco.getStatus'
const CREATE_CHECKOUT = 'social.mu.deco.createCheckout'
const CANCEL = 'social.mu.deco.cancel'
const REQUEST_TIMEOUT = 10_000

export type SupporterSubscriptionStatus = {
  active: boolean
  paidUntil?: string
  cancelAtPeriodEnd: boolean
  plan: {
    amount: string
    currency: string
    billingMonths: number
  }
}

export class SupporterSubscriptionError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

const supporterSubscriptionQueryKeyRoot = 'supporter-subscription'
export const createSupporterSubscriptionQueryKey = (did: string) =>
  createQueryKey(supporterSubscriptionQueryKeyRoot, {did})

async function request<T>(
  client: Client,
  method: NsidString,
  httpMethod: 'GET' | 'POST',
): Promise<T> {
  const data = await client.call(com.atproto.server.getServiceAuth, {
    aud: BRAND.decorations.serviceDid,
    lxm: method,
  })
  const response = await fetch(
    `${BRAND.decorations.serviceUrl}/xrpc/${method}`,
    {
      method: httpMethod,
      headers: {
        authorization: `Bearer ${data.token}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    },
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: unknown
      message?: unknown
    }
    throw new SupporterSubscriptionError(
      typeof body.message === 'string'
        ? body.message
        : `Supporter subscription request failed (${response.status})`,
      typeof body.error === 'string' ? body.error : undefined,
    )
  }
  return (await response.json()) as T
}

export function useSupporterSubscriptionQuery({
  pollUntilActive = false,
}: {
  pollUntilActive?: boolean
} = {}) {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did ?? ''

  return useQuery({
    queryKey: createSupporterSubscriptionQueryKey(did),
    enabled: BRAND.decorations.enabled && !!did,
    staleTime: 30_000,
    queryFn: () =>
      request<SupporterSubscriptionStatus>(pdsClient, GET_STATUS, 'GET'),
    refetchInterval: query =>
      pollUntilActive && !query.state.data?.active ? 2_000 : false,
  })
}

export function useCreateSupporterCheckoutMutation() {
  const pdsClient = usePdsClient()
  return useMutation({
    mutationFn: () =>
      request<{checkoutUrl: string}>(pdsClient, CREATE_CHECKOUT, 'POST'),
  })
}

export function useCancelSupporterSubscriptionMutation() {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      request<SupporterSubscriptionStatus>(pdsClient, CANCEL, 'POST'),
    onSuccess(status) {
      if (!currentAccount) return
      queryClient.setQueryData(
        createSupporterSubscriptionQueryKey(currentAccount.did),
        status,
      )
    },
  })
}
