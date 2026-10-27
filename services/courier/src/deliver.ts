import {type Logger} from 'pino'

import {type ApnsRequest} from './apns.ts'
import {type FcmRequest} from './fcm.ts'
import {type Metrics} from './metrics.ts'
import {
  apnsPayload,
  apnsSilentPayload,
  type Copy,
  displayCopy,
  fcmData,
  fcmSilentData,
} from './payload.ts'
import {type Job, type SendResult, type Store} from './types.ts'

export type Senders = {
  apns?: {send(request: ApnsRequest): Promise<SendResult>; close(): void}
  fcm?: {send(request: FcmRequest): Promise<SendResult>}
}

export type Outcome =
  | {kind: 'sent' | 'invalid_token' | 'unconfigured' | 'expired'}
  | {kind: 'retry' | 'failed'; reason: string}

/**
 * Makes one attempt at one job: builds the platform payload, sends it, and
 * forgets tokens Apple or Google call dead. Whether and when to try again is
 * the worker's call.
 */
export class Deliverer {
  private senders: Senders
  private store: Store
  private metrics: Metrics
  private logger: Logger
  private generic: Copy

  constructor({
    senders,
    store,
    metrics,
    logger,
    generic,
  }: {
    senders: Senders
    store: Store
    metrics: Metrics
    logger: Logger
    generic: Copy
  }) {
    this.senders = senders
    this.store = store
    this.metrics = metrics
    this.logger = logger
    this.generic = generic
  }

  async deliver(job: Job): Promise<Outcome> {
    if (job.expiresAt.getTime() <= Date.now()) return {kind: 'expired'}
    const send = this.sendFor(job)
    if (!send) return {kind: 'unconfigured'}

    const result = await send()
    if (result.ok) return {kind: 'sent'}
    if (result.invalidToken) {
      await this.prune(job, result.reason, result.invalidSince)
      return {kind: 'invalid_token'}
    }
    return {kind: result.retryable ? 'retry' : 'failed', reason: result.reason}
  }

  private sendFor({
    device,
    notification,
    expiresAt,
  }: Job): (() => Promise<SendResult>) | undefined {
    const {apns, fcm} = this.senders
    const silent = notification.clientControlled
    const copy = displayCopy(notification, device.ageRestricted, this.generic)
    const expiration = Math.floor(expiresAt.getTime() / 1000)
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
    {device}: Job,
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
