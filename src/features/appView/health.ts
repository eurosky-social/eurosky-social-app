import {useSyncExternalStore} from 'react'
import {type Agent, type AgentOptions, buildAgent} from '@atproto/lex'

/**
 * Consecutive failures before the AppView counts as down. High enough that one
 * query's retries cannot trip it on their own.
 */
const TRIP_AFTER = 5

let failures = 0
let down = false
const listeners = new Set<() => void>()

function setDown(next: boolean) {
  if (next === down) return
  down = next
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isAppViewDown(): boolean {
  return down
}

export function useAppViewDown(): boolean {
  return useSyncExternalStore(subscribe, isAppViewDown, isAppViewDown)
}

/** Start counting from zero again, e.g. after a probe found the AppView up. */
export function resetAppViewHealth() {
  failures = 0
  setDown(false)
}

/**
 * Circuit breaker over requests bound for the active AppView. Only 5xx and
 * missing responses (`null`) count as failures: any other status means the
 * AppView answered.
 */
export function reportAppViewResult(status: number | null) {
  if (status !== null && status < 500) {
    resetAppViewHealth()
    return
  }
  failures++
  if (failures >= TRIP_AFTER) setDown(true)
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

/**
 * Feed an agent's AppView request outcomes to the circuit breaker.
 *
 * With `proxyService`, the agent reaches the AppView through the account host:
 * only requests proxied to that service count, and one that got no response is
 * ignored, since it never reached the AppView (the account host or the device's
 * network failed). Without it, the agent talks to the AppView directly and
 * every request counts.
 */
export function withAppViewHealth(
  agentOptions: Agent | AgentOptions,
  proxyService?: string,
): Agent {
  const agent = buildAgent(agentOptions)
  return {
    get did() {
      return agent.did
    },
    fetchHandler(path, init) {
      const response = agent.fetchHandler(path, init)
      const isAppViewRequest =
        !proxyService ||
        new Headers(init.headers).get('atproto-proxy') === proxyService
      if (isAppViewRequest) {
        response.then(
          res => reportAppViewResult(res.status),
          error => {
            if (!proxyService && !isAbortError(error)) reportAppViewResult(null)
          },
        )
      }
      return response
    },
  }
}
