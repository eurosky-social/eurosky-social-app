import {type Client, type Service} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'

import {PUBLIC_BSKY_SERVICE} from '#/lib/constants'
import {BRAND} from '#/config/brand'
import {BLUESKY_PROXY_DID} from '#/env'
import {app} from '#/lexicons'
import {device} from '#/storage'
import {
  APP_VIEW_PRESETS,
  type AppViewPresetId,
  getAppViewDid,
  getPreferredAppView,
  getPublicAppViewUrl,
  isConfiguredAppView,
} from './config'
import {type AppViewPreference} from './types'

const PROBE_TIMEOUT_MS = 10_000

/** The only AppViews the app offers to fail over to. */
const FAILOVER_PRESET_IDS: readonly AppViewPresetId[] = ['bluesky', 'eurosky']

export type AppViewFailoverCandidate = AppViewPreference & {
  id: AppViewPresetId
}

/** The AppView this process is using right now. */
export function getActiveAppView(): AppViewPreference {
  return {
    url: getPublicAppViewUrl(PUBLIC_BSKY_SERVICE),
    did: getAppViewDid(BLUESKY_PROXY_DID),
  }
}

/**
 * AppViews to try when `current` fails, the build's default first. Empty in a
 * local dev env, whose accounts do not exist on the production AppViews.
 */
export function getFailoverCandidates(
  current: AppViewPreference,
): AppViewFailoverCandidate[] {
  if (BLUESKY_PROXY_DID !== BRAND.services.appViewDid) return []
  return APP_VIEW_PRESETS.filter(
    preset =>
      FAILOVER_PRESET_IDS.includes(preset.id) && preset.did !== current.did,
  ).sort(
    (a, b) => Number(isConfiguredAppView(b)) - Number(isConfiguredAppView(a)),
  )
}

/** Who is asking: a signed-in account probes through its account host. */
export type AppViewProbeSession = {client: Client; did: string} | undefined

/**
 * Whether an AppView answers. Signed in, the probe loads the account's own
 * profile through the account host, the same route real requests take; that
 * also fails when the account host is down or the account is not available on
 * that AppView, both cases where switching to it would not help. Signed out,
 * it hits the AppView's health endpoint directly.
 */
export async function probeAppView(
  appView: AppViewPreference,
  session: AppViewProbeSession,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    if (session) {
      await session.client.call(
        app.bsky.actor.getProfile,
        {actor: session.did as DidString},
        {
          service: `${appView.did}#bsky_appview` as Service,
          signal: controller.signal,
        },
      )
      return true
    }
    const response = await fetcher(`${appView.url}/xrpc/_health`, {
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Pick the AppView to offer after the active one tripped the circuit breaker.
 * Returns nothing when the active AppView answers after all, or when no
 * candidate does (e.g. the device is offline).
 */
export async function findAppViewFailover(
  session: AppViewProbeSession,
  probe: typeof probeAppView = probeAppView,
): Promise<AppViewFailoverCandidate | undefined> {
  const current = getActiveAppView()
  const candidates = getFailoverCandidates(current)
  if (!candidates.length || (await probe(current, session))) return undefined
  for (const candidate of candidates) {
    if (await probe(candidate, session)) return candidate
  }
  return undefined
}

/**
 * Use `appView` from the next start on, without touching the saved preference.
 * Failing over to the preferred AppView is just ending the failover.
 */
export function saveAppViewFailover(appView: AppViewPreference) {
  const {url, did} = appView
  device.set(
    ['appViewFailover'],
    did === getPreferredAppView().did ? undefined : {url, did},
  )
}

/**
 * End a failover once the preferred AppView answers again. The running process
 * keeps the failover; the next start is back on the preferred AppView.
 */
export async function endAppViewFailoverIfRecovered(
  session: AppViewProbeSession,
  probe: typeof probeAppView = probeAppView,
): Promise<void> {
  if (!device.get(['appViewFailover'])) return
  if (await probe(getPreferredAppView(), session)) {
    device.set(['appViewFailover'], undefined)
  }
}
