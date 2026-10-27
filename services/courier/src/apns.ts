import http2 from 'node:http2'
import {type KeyObject} from 'node:crypto'

import {type ApnsConfig} from './config.ts'
import {loadPrivateKey, signJwt} from './jwt.ts'
import {type SendResult} from './types.ts'

/*
 * Apple rejects provider tokens older than an hour and throttles refreshing
 * them more often than every 20 minutes.
 */
const PROVIDER_TOKEN_LIFETIME_MS = 50 * 60 * 1000

const HEX_TOKEN = /^[0-9a-fA-F]{32,512}$/

/**
 * Reasons after which Apple will never deliver to the token again.
 */
const DEAD_TOKEN_REASONS = new Set([
  'BadDeviceToken',
  'DeviceTokenNotForTopic',
  'ExpiredToken',
  'Unregistered',
])

export type ApnsRequest = {
  token: string
  /**
   * The app's bundle identifier.
   */
  topic: string
  /**
   * Unix seconds after which Apple stops trying to reach the device.
   */
  expiration: number
  payload: Record<string, unknown>
}

type RawResponse = {status: number; reason: string; timestamp?: number}

/**
 * Sends alert pushes over one long-lived HTTP/2 connection, reconnecting on
 * the next send after Apple closes it.
 */
export class ApnsClient {
  private origin: string
  private keyId: string
  private teamId: string
  private key: KeyObject
  private timeoutMs: number
  private session?: http2.ClientHttp2Session
  private providerToken?: {jwt: string; issuedAt: number}

  constructor(config: ApnsConfig, {timeoutMs = 10_000} = {}) {
    this.origin = config.origin
    this.keyId = config.keyId
    this.teamId = config.teamId
    this.key = loadPrivateKey(config.privateKey)
    this.timeoutMs = timeoutMs
  }

  async send(request: ApnsRequest): Promise<SendResult> {
    // The token ends up in the request path, so anything but hex is refused.
    if (!HEX_TOKEN.test(request.token)) {
      return {
        ok: false,
        invalidToken: true,
        retryable: false,
        reason: 'BadDeviceToken',
      }
    }
    const jwt = this.currentProviderToken()
    let response = await this.post(request, jwt)
    if (response.status === 403 && response.reason === 'ExpiredProviderToken') {
      if (this.providerToken?.jwt === jwt) this.providerToken = undefined
      response = await this.post(request, this.currentProviderToken())
    }
    return classify(response)
  }

  close(): void {
    this.session?.close()
    this.session = undefined
  }

  private currentProviderToken(): string {
    const now = Date.now()
    if (
      !this.providerToken ||
      now - this.providerToken.issuedAt > PROVIDER_TOKEN_LIFETIME_MS
    ) {
      const jwt = signJwt(
        {alg: 'ES256', kid: this.keyId},
        {iss: this.teamId, iat: Math.floor(now / 1000)},
        this.key,
      )
      this.providerToken = {jwt, issuedAt: now}
    }
    return this.providerToken.jwt
  }

  private connection(): http2.ClientHttp2Session {
    const existing = this.session
    if (existing && !existing.closed && !existing.destroyed) return existing
    const session = http2.connect(this.origin)
    const forget = () => {
      if (this.session === session) this.session = undefined
    }
    // Failures also reach every open stream, which reports them per send.
    session.on('error', forget)
    session.on('goaway', forget)
    session.on('close', forget)
    this.session = session
    return session
  }

  private post(request: ApnsRequest, jwt: string): Promise<RawResponse> {
    return new Promise(resolve => {
      let stream: http2.ClientHttp2Stream
      try {
        stream = this.connection().request({
          ':method': 'POST',
          ':path': `/3/device/${request.token}`,
          authorization: `bearer ${jwt}`,
          'apns-topic': request.topic,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': String(request.expiration),
          'content-type': 'application/json',
        })
      } catch (err) {
        this.session = undefined
        resolve({status: 0, reason: errorMessage(err)})
        return
      }
      let status = 0
      let failure = ''
      const chunks: Buffer[] = []
      stream.setTimeout(this.timeoutMs, () => {
        failure = 'timeout'
        stream.close(http2.constants.NGHTTP2_CANCEL)
      })
      stream.on('response', headers => {
        status = Number(headers[':status'])
      })
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('error', err => {
        failure = errorMessage(err)
      })
      stream.on('close', () => {
        if (status === 0) {
          resolve({status: 0, reason: failure || 'stream closed'})
          return
        }
        resolve({status, ...parseBody(Buffer.concat(chunks).toString())})
      })
      stream.end(JSON.stringify(request.payload))
    })
  }
}

function classify({status, reason, timestamp}: RawResponse): SendResult {
  if (status === 200) return {ok: true}
  if (status === 410 || DEAD_TOKEN_REASONS.has(reason)) {
    return {
      ok: false,
      invalidToken: true,
      retryable: false,
      reason,
      invalidSince: timestamp ? new Date(timestamp) : undefined,
    }
  }
  return {
    ok: false,
    invalidToken: false,
    retryable: status === 0 || status === 429 || status >= 500,
    reason: reason || `HTTP ${status}`,
  }
}

function parseBody(body: string): {reason: string; timestamp?: number} {
  if (!body) return {reason: ''}
  try {
    const parsed = JSON.parse(body) as {reason?: unknown; timestamp?: unknown}
    return {
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      timestamp:
        typeof parsed.timestamp === 'number' ? parsed.timestamp : undefined,
    }
  } catch {
    return {reason: body.slice(0, 200)}
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
