import {type DidString, isValidDid} from '@atproto/syntax'

import {BRAND} from '#/config/brand'
import {BLUESKY_PROXY_DID} from '#/env'
import {device} from '#/storage'
import {type AppViewPreference} from './types'

export type AppViewPresetId = 'bluesky' | 'eurosky' | 'blacksky'
export type AppViewOptionId = AppViewPresetId | 'custom'

export const APP_VIEW_PRESETS: readonly (AppViewPreference & {
  id: AppViewPresetId
})[] = [
  {
    id: 'bluesky',
    url: 'https://api.bsky.app',
    did: 'did:web:api.bsky.app',
  },
  {
    id: 'eurosky',
    url: 'https://api.eurosky.network',
    did: 'did:web:api.eurosky.network',
  },
  {
    id: 'blacksky',
    url: 'https://api.blacksky.community',
    did: 'did:web:api.blacksky.community',
  },
]

export type AppViewValidationErrorCode =
  | 'invalid-url'
  | 'https-required'
  | 'base-url-required'
  | 'did-document-unavailable'
  | 'invalid-did-document'
  | 'missing-appview-service'
  | 'endpoint-mismatch'

export class AppViewValidationError extends Error {
  constructor(public code: AppViewValidationErrorCode) {
    super(code)
    this.name = 'AppViewValidationError'
  }
}

/** Normalize an AppView base URL and reject URL parts that cannot identify it. */
export function normalizeAppViewUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new AppViewValidationError('invalid-url')
  }

  const isLocalhost = url.hostname === 'localhost'
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    throw new AppViewValidationError('https-required')
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new AppViewValidationError('base-url-required')
  }

  return url.origin
}

/** Convert an AppView URL to the did:web identifier its host must publish. */
export function appViewUrlToDid(input: string): `did:web:${string}` {
  const url = new URL(normalizeAppViewUrl(input))
  const did = `did:web:${url.host.replace(/:/g, '%3A')}` as const
  if (!isValidDid(did)) {
    throw new AppViewValidationError('invalid-url')
  }
  return did
}

type DidDocument = {
  id?: string
  service?: Array<{
    id?: string
    type?: string | string[]
    serviceEndpoint?: string
  }>
}

/**
 * Verify that a custom URL publishes a matching did:web document with a
 * #bsky_appview service. Authenticated requests are routed by this DID, while
 * logged-out requests use the URL, so requiring them to agree prevents the two
 * session states from silently talking to different services.
 */
export async function resolveCustomAppView(
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<AppViewPreference> {
  const url = normalizeAppViewUrl(input)
  const did = appViewUrlToDid(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let response: Response
  try {
    response = await fetcher(`${url}/.well-known/did.json`, {
      headers: {accept: 'application/did+ld+json, application/json'},
      signal: controller.signal,
    })
  } catch {
    throw new AppViewValidationError('did-document-unavailable')
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new AppViewValidationError('did-document-unavailable')
  }

  let document: DidDocument
  try {
    document = (await response.json()) as DidDocument
  } catch {
    throw new AppViewValidationError('invalid-did-document')
  }
  if (document.id !== did || !Array.isArray(document.service)) {
    throw new AppViewValidationError('invalid-did-document')
  }

  const service = document.service.find(item => {
    const hasType = Array.isArray(item.type)
      ? item.type.includes('BskyAppView')
      : item.type === 'BskyAppView'
    return (
      hasType &&
      (item.id === '#bsky_appview' || item.id === `${did}#bsky_appview`)
    )
  })
  if (!service?.serviceEndpoint) {
    throw new AppViewValidationError('missing-appview-service')
  }

  let endpoint: string
  try {
    endpoint = normalizeAppViewUrl(service.serviceEndpoint)
  } catch {
    throw new AppViewValidationError('endpoint-mismatch')
  }
  if (endpoint !== url) {
    throw new AppViewValidationError('endpoint-mismatch')
  }

  return {url, did}
}

/** The build-time default shown in settings when no device override is saved. */
export function getConfiguredAppView(): AppViewPreference {
  return {
    url: BRAND.services.appView,
    did: BLUESKY_PROXY_DID,
  }
}

function asValidPreference(
  preference: AppViewPreference | undefined,
): AppViewPreference | undefined {
  if (!preference || !isValidDid(preference.did)) return undefined
  try {
    return {...preference, url: normalizeAppViewUrl(preference.url)}
  } catch {
    return undefined
  }
}

export function readAppViewOverride(): AppViewPreference | undefined {
  return asValidPreference(device.get(['appViewOverride']))
}

/** Resolve the PDS proxy service while preserving test/build defaults. */
export function getAppViewProxyService(defaultService: string): string {
  const override = readAppViewOverride()
  return override ? `${override.did}#bsky_appview` : defaultService
}

/** Resolve the direct URL used by the unauthenticated AppView client. */
export function getPublicAppViewUrl(defaultUrl: string): string {
  return readAppViewOverride()?.url ?? defaultUrl
}

/** Resolve the AppView DID for flows that authenticate directly to it. */
export function getAppViewDid(defaultDid: string): DidString {
  return (readAppViewOverride()?.did ?? defaultDid) as DidString
}

export function getAppViewOptionId(
  preference: AppViewPreference,
): AppViewOptionId {
  return (
    APP_VIEW_PRESETS.find(preset => preset.did === preference.did)?.id ??
    'custom'
  )
}

export function isConfiguredAppView(preference: AppViewPreference): boolean {
  return preference.did === getConfiguredAppView().did
}
