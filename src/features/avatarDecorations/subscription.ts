import {type Client} from '@atproto/lex'
import {type NsidString} from '@atproto/syntax'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {BRAND} from '#/config/brand'
import {com} from '#/lexicons'

const GET_STATUS = 'social.mu.deco.getStatus'
const CREATE_CHECKOUT = 'social.mu.deco.createCheckout'
const CANCEL = 'social.mu.deco.cancel'
const REQUEST_TIMEOUT = 10_000

export type DecorationSubscriptionStatus = {
  active: boolean
  paidUntil?: string
  cancelAtPeriodEnd: boolean
  plan: {
    amount: string
    currency: string
    billingMonths: number
  }
}

export class DecorationSubscriptionError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

const subscriptionQueryKeyRoot = 'decoration-subscription'
export const createDecorationSubscriptionQueryKey = (did: string) =>
  createQueryKey(subscriptionQueryKeyRoot, {did})

async function bearer(client: Client, lxm: NsidString): Promise<string> {
  const data = await client.call(com.atproto.server.getServiceAuth, {
    aud: BRAND.decorations.serviceDid,
    lxm,
  })
  return `Bearer ${data.token}`
}

async function request<T>(
  client: Client,
  method: NsidString,
  httpMethod: 'GET' | 'POST',
): Promise<T> {
  const authorization = await bearer(client, method)
  const response = await fetch(
    `${BRAND.decorations.serviceUrl}/xrpc/${method}`,
    {
      method: httpMethod,
      headers: {authorization, accept: 'application/json'},
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    },
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: unknown
      message?: unknown
    }
    throw new DecorationSubscriptionError(
      typeof body.message === 'string'
        ? body.message
        : `Decoration subscription request failed (${response.status})`,
      typeof body.error === 'string' ? body.error : undefined,
    )
  }
  return (await response.json()) as T
}

export function useDecorationSubscriptionQuery({
  pollUntilActive = false,
}: {
  pollUntilActive?: boolean
} = {}) {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did ?? ''

  return useQuery({
    queryKey: createDecorationSubscriptionQueryKey(did),
    enabled: BRAND.decorations.enabled && !!did,
    staleTime: 30_000,
    queryFn: () =>
      request<DecorationSubscriptionStatus>(pdsClient, GET_STATUS, 'GET'),
    refetchInterval: query =>
      pollUntilActive && !query.state.data?.active ? 2_000 : false,
  })
}

export function useCreateDecorationCheckoutMutation() {
  const pdsClient = usePdsClient()
  return useMutation({
    mutationFn: () =>
      request<{checkoutUrl: string}>(pdsClient, CREATE_CHECKOUT, 'POST'),
  })
}

export function useCancelDecorationSubscriptionMutation() {
  const pdsClient = usePdsClient()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      request<DecorationSubscriptionStatus>(pdsClient, CANCEL, 'POST'),
    onSuccess(status) {
      if (!currentAccount) return
      queryClient.setQueryData(
        createDecorationSubscriptionQueryKey(currentAccount.did),
        status,
      )
    },
  })
}
