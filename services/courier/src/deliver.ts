import {timestampDate} from '@bufbuild/protobuf/wkt'
import {type Logger} from 'pino'

import {type ApnsRequest} from './apns.ts'
import {type FcmRequest} from './fcm.ts'
import {type Notification} from './gen/courier_pb.js'
import {type Metrics} from './metrics.ts'
import {
  apnsPayload,
  apnsSilentPayload,
  type Copy,
  displayCopy,
  fcmData,
  fcmSilentData,
} from './payload.ts'
import {type Device, type SendResult, type TokenStore} from './types.ts'

export type Senders = {
  apns?: {send(request: ApnsRequest): Promise<SendResult>; close(): void}
  fcm?: {send(request: FcmRequest): Promise<SendResult>}
}

export type Send = {device: Device; notification: Notification}

/**
 * Pauses before the second and third attempt of a send that failed in a way
 * worth retrying.
 */
const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000]

/**
 * Delivers one notification to one device: builds the platform payload,
 * retries passing failures and forgets tokens Apple or Google call dead.
 */
export class Deliverer {
  private senders: Senders
  private store: TokenStore
  private metrics: Metrics
  private logger: Logger
  private generic: Copy
  private ttlSeconds: number
  private retryDelaysMs: number[]

  constructor({
    senders,
    store,
    metrics,
    logger,
    generic,
    ttlSeconds,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  }: {
    senders: Senders
    store: TokenStore
    metrics: Metrics
    logger: Logger
    generic: Copy
    ttlSeconds: number
    retryDelaysMs?: number[]
  }) {
    this.senders = senders
    this.store = store
    this.metrics = metrics
    this.logger = logger
    this.generic = generic
    this.ttlSeconds = ttlSeconds
    this.retryDelaysMs = retryDelaysMs
  }

  async deliver({device, notification}: Send): Promise<void> {
    const platform = device.platform
    const kind = notification.clientControlled ? 'silent' : 'alert'
    const createdAt = notification.timestamp
      ? timestampDate(notification.timestamp).getTime()
      : Date.now()
    const expiration = Math.floor(createdAt / 1000) + this.ttlSeconds
    // Drops stale ones, e.g. from a long AppView retry or indexer backfill.
    if (expiration <= Date.now() / 1000) {
      this.metrics.deliveries.inc({platform, kind, outcome: 'expired'})
      return
    }

    const send = this.sendFor(device, notification, expiration)
    if (!send) {
      this.metrics.deliveries.inc({platform, kind, outcome: 'unconfigured'})
      return
    }

    for (let attempt = 0; ; attempt++) {
      const result = await send()
      if (result.ok) {
        this.metrics.deliveries.inc({platform, kind, outcome: 'sent'})
        return
      }
      if (result.invalidToken) {
        this.metrics.deliveries.inc({platform, kind, outcome: 'invalid_token'})
        await this.prune(device, result.reason, result.invalidSince)
        return
      }
      const delay = this.retryDelaysMs[attempt]
      if (!result.retryable || delay === undefined) {
        this.metrics.deliveries.inc({platform, kind, outcome: 'failed'})
        this.logger.warn(
          {
            platform,
            did: device.did,
            notificationId: notification.id,
            reason: result.reason,
            attempts: attempt + 1,
          },
          'push not delivered',
        )
        return
      }
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  private sendFor(
    device: Device,
    notification: Notification,
    expiration: number,
  ): (() => Promise<SendResult>) | undefined {
    const {apns, fcm} = this.senders
    const silent = notification.clientControlled
    const copy = displayCopy(notification, device.ageRestricted, this.generic)
    if (device.platform === 'ios' && apns) {
      const payload = silent
        ? apnsSilentPayload(notification)
        : apnsPayload(notification, copy)
      return () =>
        apns.send({
          token: device.token,
          topic: device.appId,
          pushType: silent ? 'background' : 'alert',
          expiration,
          payload,
        })
    }
    if (device.platform === 'android' && fcm) {
      const data = silent
        ? fcmSilentData(notification)
        : fcmData(notification, copy)
      const ttlSeconds = Math.max(1, expiration - Math.floor(Date.now() / 1000))
      return () =>
        fcm.send({
          token: device.token,
          data,
          priority: silent ? 'NORMAL' : 'HIGH',
          collapseKey: silent
            ? notification.collapseKey || undefined
            : undefined,
          ttlSeconds,
        })
    }
    return undefined
  }

  private async prune(
    device: Device,
    reason: string,
    invalidSince: Date | undefined,
  ): Promise<void> {
    try {
      const removed = await this.store.removeToken(device.token, invalidSince)
      if (removed > 0) {
        this.metrics.tokensPruned.inc({platform: device.platform}, removed)
      }
      this.logger.info(
        {platform: device.platform, did: device.did, reason, removed},
        'removed dead device token',
      )
    } catch (err) {
      this.logger.error({err}, 'failed to remove dead device token')
    }
  }
}
