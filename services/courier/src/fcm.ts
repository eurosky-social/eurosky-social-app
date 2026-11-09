import {type KeyObject} from 'node:crypto'

import {type FcmConfig} from './config.ts'
import {loadPrivateKey, signJwt} from './jwt.ts'
import {type SendResult} from './types.ts'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

/**
 * Renew the access token this long before Google says it expires.
 */
const ACCESS_TOKEN_MARGIN_MS = 5 * 60 * 1000

const FCM_TOKEN = /^[A-Za-z0-9_:-]{32,4096}$/

export type FcmRequest = {
  token: string
  /**
   * FCM data values must all be strings.
   */
  data: Record<string, string>
  /**
   * `HIGH` wakes a dozing device for something the user should see now.
   */
  priority: 'HIGH' | 'NORMAL'
  /**
   * While the device is offline, Google keeps only the newest message per key.
   */
  collapseKey?: string
  ttlSeconds: number
}

type RawResponse = {status: number; code: string; message: string}

/**
 * Sends data messages through the FCM HTTP v1 API, authenticated with a
 * service account.
 */
export class FcmClient {
  private projectId: string
  private clientEmail: string
  private tokenUri: string
  private origin: string
  private key: KeyObject
  private timeoutMs: number
  private accessToken?: {value: string; expiresAt: number}
  private pendingAccessToken?: Promise<string>

  constructor(config: FcmConfig, {timeoutMs = 10_000} = {}) {
    this.projectId = config.projectId
    this.clientEmail = config.clientEmail
    this.tokenUri = config.tokenUri
    this.origin = config.origin
    this.key = loadPrivateKey(config.privateKey)
    this.timeoutMs = timeoutMs
  }

  async send(request: FcmRequest): Promise<SendResult> {
    if (!FCM_TOKEN.test(request.token)) {
      return {
        ok: false,
        invalidToken: true,
        retryable: false,
        reason: 'INVALID_ARGUMENT',
      }
    }
    let accessToken: string
    try {
      accessToken = await this.currentAccessToken()
    } catch (err) {
      return {
        ok: false,
        invalidToken: false,
        retryable: true,
        reason: `access token: ${errorMessage(err)}`,
      }
    }
    let response = await this.post(request, accessToken)
    if (response.status === 401) {
      if (this.accessToken?.value === accessToken) this.accessToken = undefined
      try {
        response = await this.post(request, await this.currentAccessToken())
      } catch (err) {
        response = {status: 0, code: '', message: errorMessage(err)}
      }
    }
    return classify(response)
  }

  private currentAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      Date.now() < this.accessToken.expiresAt - ACCESS_TOKEN_MARGIN_MS
    ) {
      return Promise.resolve(this.accessToken.value)
    }
    // Concurrent sends share one token request.
    this.pendingAccessToken ??= this.fetchAccessToken().finally(() => {
      this.pendingAccessToken = undefined
    })
    return this.pendingAccessToken
  }

  private async fetchAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const assertion = signJwt(
      {alg: 'RS256', typ: 'JWT'},
      {
        iss: this.clientEmail,
        scope: SCOPE,
        aud: this.tokenUri,
        iat: now,
        exp: now + 3600,
      },
      this.key,
    )
    const res = await fetch(this.tokenUri, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    const body = (await res.json()) as {
      access_token?: unknown
      expires_in?: unknown
    }
    if (typeof body.access_token !== 'string') {
      throw new Error('no access_token in response')
    }
    const expiresIn =
      typeof body.expires_in === 'number' ? body.expires_in : 3600
    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    }
    return body.access_token
  }

  private async post(
    request: FcmRequest,
    accessToken: string,
  ): Promise<RawResponse> {
    try {
      const res = await fetch(
        `${this.origin}/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: request.token,
              data: request.data,
              android: {
                priority: request.priority,
                ttl: `${request.ttlSeconds}s`,
                ...(request.collapseKey && {collapse_key: request.collapseKey}),
              },
            },
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      )
      if (res.ok) {
        await res.body?.cancel()
        return {status: res.status, code: '', message: ''}
      }
      return {status: res.status, ...parseError(await res.text())}
    } catch (err) {
      return {status: 0, code: '', message: errorMessage(err)}
    }
  }
}

function classify({status, code, message}: RawResponse): SendResult {
  if (status >= 200 && status < 300) return {ok: true}
  const reason = code || message || `HTTP ${status}`
  if (
    code === 'UNREGISTERED' ||
    code === 'SENDER_ID_MISMATCH' ||
    (code === 'INVALID_ARGUMENT' && /registration token/i.test(message))
  ) {
    return {ok: false, invalidToken: true, retryable: false, reason}
  }
  return {
    ok: false,
    invalidToken: false,
    retryable: status === 0 || status === 429 || status >= 500,
    reason,
  }
}

/**
 * FCM puts its precise error code in an `FcmError` detail and the generic
 * gRPC status in `error.status`; the detail wins when both are present.
 */
function parseError(body: string): {code: string; message: string} {
  try {
    const {error} = JSON.parse(body) as {
      error?: {
        status?: string
        message?: string
        details?: {'@type'?: string; errorCode?: string}[]
      }
    }
    const detail = error?.details?.find(d =>
      d['@type']?.endsWith('google.firebase.fcm.v1.FcmError'),
    )
    return {
      code: detail?.errorCode ?? error?.status ?? '',
      message: error?.message ?? '',
    }
  } catch {
    return {code: '', message: body.slice(0, 200)}
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
