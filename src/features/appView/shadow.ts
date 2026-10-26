import {isService, type Service} from '@atproto/lex'

import {
  BLUESKY_APPVIEW,
  BLUESKY_APPVIEW_SERVICE,
  BLUESKY_PUBLIC_APPVIEW,
} from '#/lib/constants'
import {plausible} from '#/analytics/plausible'
import {APPVIEW_SHADOW_EVENTS} from '#/analytics/plausible/shared'
import * as env from '#/env'

export type AppViewShadowConfig = {
  percentage: number
  targetUrl: URL
  targetService: Service
}

type AppViewShadowRoute = 'pds-proxy' | 'public'

type AppViewShadowFailureType = 'http' | 'network' | 'response-body' | 'timeout'

type AppViewShadowResult = {
  outcome: 'success' | 'failure'
  nsid: string
  route: AppViewShadowRoute
  statusCode?: number
  failureType?: AppViewShadowFailureType
}

type AppViewShadowFetchOptions = {
  config?: AppViewShadowConfig
  random?: () => number
  shadowFetch?: typeof fetch
  timeoutMs?: number
  onResult?: (result: AppViewShadowResult) => void
}

const DEFAULT_SHADOW_TIMEOUT_MS = 10_000

const BLUESKY_APPVIEW_ORIGINS = new Set([
  new URL(BLUESKY_APPVIEW).origin,
  new URL(BLUESKY_PUBLIC_APPVIEW).origin,
])

/**
 * Resolve the build-time shadow target. Invalid or self-referential settings
 * fail closed so a bad rollout variable never changes normal AppView traffic.
 */
export function getAppViewShadowConfig(): AppViewShadowConfig | undefined {
  if (env.APPVIEW_SHADOW_PERCENTAGE <= 0) return undefined

  let targetUrl: URL
  try {
    targetUrl = new URL(env.APPVIEW_SHADOW_URL)
  } catch {
    return undefined
  }

  const targetService = `${env.APPVIEW_SHADOW_DID}#bsky_appview`
  const isLocalhost = targetUrl.hostname === 'localhost'
  if (
    (targetUrl.protocol !== 'https:' &&
      !(isLocalhost && targetUrl.protocol === 'http:')) ||
    targetUrl.username ||
    targetUrl.password ||
    targetUrl.search ||
    targetUrl.hash ||
    (targetUrl.pathname !== '/' && targetUrl.pathname !== '') ||
    !isService(targetService) ||
    BLUESKY_APPVIEW_ORIGINS.has(targetUrl.origin) ||
    targetService === BLUESKY_APPVIEW_SERVICE
  ) {
    return undefined
  }

  return {
    percentage: env.APPVIEW_SHADOW_PERCENTAGE,
    targetUrl,
    targetService,
  }
}

/**
 * Add sampled, fire-and-forget shadow reads at the raw fetch layer.
 *
 * Bearer-authenticated requests are copied only after the session has added
 * its auth header. The duplicate goes directly through the underlying fetch
 * with a different `atproto-proxy` value, so its response never enters the live
 * session's 401/invalid-token handling. DPoP requests are not copied: replaying
 * their one-use proof could cause the PDS to reject the primary request. Public
 * requests are copied directly to the candidate origin. In every case only the
 * primary response is observable by the caller.
 */
export function withAppViewShadowFetch(
  primaryFetch: typeof fetch,
  options: AppViewShadowFetchOptions = {},
): typeof fetch {
  const config = options.config ?? getAppViewShadowConfig()
  if (!config) return primaryFetch

  const random = options.random ?? Math.random
  const onResult = options.onResult ?? trackShadowResult
  const shadowFetch = options.shadowFetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHADOW_TIMEOUT_MS

  return (input, init) => {
    const primaryResponse = primaryFetch(input, init)
    const sourceUrl = asUrl(input)
    const headers = requestHeaders(input, init)
    const hasDpopProof =
      headers.has('dpop') ||
      /^DPoP\s/i.test(headers.get('authorization')?.trim() ?? '')
    const isProxiedBlueskyRead =
      !hasDpopProof && headers.get('atproto-proxy') === BLUESKY_APPVIEW_SERVICE
    const isDirectBlueskyRead = sourceUrl
      ? BLUESKY_APPVIEW_ORIGINS.has(sourceUrl.origin)
      : false

    if (
      sourceUrl &&
      isRead(input, init) &&
      !hasDpopProof &&
      (isProxiedBlueskyRead || isDirectBlueskyRead) &&
      isSampled(config.percentage, random)
    ) {
      const route: AppViewShadowRoute = isProxiedBlueskyRead
        ? 'pds-proxy'
        : 'public'
      const targetUrl = isProxiedBlueskyRead
        ? sourceUrl
        : new URL(`${sourceUrl.pathname}${sourceUrl.search}`, config.targetUrl)

      if (isProxiedBlueskyRead || sourceUrl.origin !== targetUrl.origin) {
        if (isProxiedBlueskyRead) {
          headers.set('atproto-proxy', config.targetService)
        }
        runShadowRequest(
          signal =>
            shadowFetch(targetUrl, {
              ...init,
              method: requestMethod(input, init),
              headers,
              signal,
            }),
          requestSignal(input, init),
          targetUrl.pathname,
          route,
          timeoutMs,
          onResult,
        )
      }
    }

    return primaryResponse
  }
}

function requestMethod(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
): string {
  const inputMethod =
    typeof Request !== 'undefined' && input instanceof Request
      ? input.method
      : undefined
  return init?.method ?? inputMethod ?? 'GET'
}

function requestHeaders(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
): Headers {
  const inputHeaders =
    typeof Request !== 'undefined' && input instanceof Request
      ? input.headers
      : undefined
  return new Headers(init?.headers ?? inputHeaders)
}

function requestSignal(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
): AbortSignal | null | undefined {
  const inputSignal =
    typeof Request !== 'undefined' && input instanceof Request
      ? input.signal
      : undefined
  return init?.signal ?? inputSignal
}

function isRead(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
): boolean {
  return requestMethod(input, init).toUpperCase() === 'GET'
}

function isSampled(percentage: number, random: () => number): boolean {
  return percentage >= 100 || random() * 100 < percentage
}

function asUrl(input: Parameters<typeof fetch>[0]): URL | undefined {
  try {
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url)
    }
    if (input instanceof URL || typeof input === 'string') {
      return new URL(input)
    }
    return undefined
  } catch {
    return undefined
  }
}

function nsidFromPath(path: string): string {
  return /^\/xrpc\/([^?]+)/.exec(path)?.[1] ?? 'unknown'
}

function runShadowRequest(
  request: (signal: AbortSignal) => Promise<Response>,
  sourceSignal: AbortSignal | null | undefined,
  path: string,
  route: AppViewShadowRoute,
  timeoutMs: number,
  onResult: (result: AppViewShadowResult) => void,
): void {
  void (async () => {
    if (sourceSignal?.aborted) return

    const nsid = nsidFromPath(path)
    const controller = new AbortController()
    let timedOut = false
    const onSourceAbort = () => controller.abort()
    sourceSignal?.addEventListener('abort', onSourceAbort, {once: true})
    let rejectTimeout!: (error: Error) => void
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject
    })
    const timeout = setTimeout(
      () => {
        timedOut = true
        controller.abort()
        rejectTimeout(new Error('AppView shadow request timed out'))
      },
      Math.max(1, timeoutMs),
    )

    try {
      let response: Response
      try {
        response = await Promise.race([
          request(controller.signal),
          timeoutPromise,
        ])
      } catch (error) {
        if (sourceSignal?.aborted) {
          return
        } else if (timedOut) {
          emitFailure(onResult, nsid, route, 'timeout')
        } else if (!isAbort(error, sourceSignal)) {
          emitFailure(onResult, nsid, route, 'network')
        }
        return
      }

      let bodyError: unknown
      try {
        await Promise.race([response.arrayBuffer(), timeoutPromise])
      } catch (error) {
        bodyError = error
      }

      if (sourceSignal?.aborted) {
        return
      } else if (timedOut) {
        emitFailure(onResult, nsid, route, 'timeout', response.status)
      } else if (isAbort(bodyError, sourceSignal)) {
        return
      } else if (!response.ok) {
        emitFailure(onResult, nsid, route, 'http', response.status)
      } else if (bodyError) {
        emitFailure(onResult, nsid, route, 'response-body', response.status)
      } else {
        emitResult(onResult, {
          outcome: 'success',
          nsid,
          route,
          statusCode: response.status,
        })
      }
    } finally {
      clearTimeout(timeout)
      sourceSignal?.removeEventListener('abort', onSourceAbort)
    }
  })()
}

function isAbort(
  error: unknown,
  sourceSignal: AbortSignal | null | undefined,
): boolean {
  return (
    sourceSignal?.aborted === true ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError')
  )
}

function emitFailure(
  onResult: (result: AppViewShadowResult) => void,
  nsid: string,
  route: AppViewShadowRoute,
  failureType: AppViewShadowFailureType,
  statusCode?: number,
) {
  emitResult(onResult, {
    outcome: 'failure',
    nsid,
    route,
    statusCode,
    failureType,
  })
}

function emitResult(
  onResult: (result: AppViewShadowResult) => void,
  result: AppViewShadowResult,
) {
  try {
    onResult(result)
  } catch {
    /* Operational telemetry must never affect either AppView request. */
  }
}

function trackShadowResult(result: AppViewShadowResult) {
  plausible.init()
  plausible.track(
    result.outcome === 'success'
      ? APPVIEW_SHADOW_EVENTS.success
      : APPVIEW_SHADOW_EVENTS.failure,
    {
      endpoint: result.nsid,
      route: result.route,
      statusCode: result.statusCode,
      failureType: result.failureType,
    },
  )
}
