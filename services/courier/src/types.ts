import {type Notification} from './gen/courier_pb.js'

export type Platform = 'ios' | 'android'

/**
 * One device registered to receive pushes for one account. A phone signed in
 * to several accounts holds the same token once per account.
 */
export type Device = {
  did: string
  token: string
  appId: string
  platform: Platform
  ageRestricted: boolean
}

/**
 * A notification the AppView handed over, with the moment it stops being
 * worth delivering.
 */
export type Incoming = {notification: Notification; expiresAt: Date}

/**
 * One queued send of one notification to one device.
 */
export type Job = {
  id: string
  device: Device
  notification: Notification
  /**
   * Attempts so far, including the one this job was claimed for.
   */
  attempts: number
  expiresAt: Date
}

export type EnqueueResult =
  | {full: true}
  | {full: false; accepted: number; duplicates: number; jobs: number}

/**
 * Persistence for device registrations and the send queue.
 */
export type Store = {
  register(device: Device): Promise<void>
  unregister(device: Pick<Device, 'did' | 'token' | 'appId'>): Promise<void>
  setAgeRestricted(did: string, ageRestricted: boolean): Promise<void>
  devicesFor(dids: string[]): Promise<Device[]>
  /**
   * Forgets a token Apple or Google reported as dead, for every account on
   * the device. With `invalidSince`, a registration renewed after that moment
   * is kept: the app re-registered the token after the provider's verdict.
   */
  removeToken(token: string, invalidSince?: Date): Promise<number>

  /**
   * Queues one job per device of each recipient, all or nothing. Notification
   * ids received before are skipped, so a batch the AppView retries is not
   * pushed twice. Nothing is recorded when the jobs would take the queue past
   * `maxQueued`.
   */
  enqueue(incoming: Incoming[], maxQueued: number): Promise<EnqueueResult>
  /**
   * Takes up to `limit` due jobs and hides them from other claims for
   * `leaseMs`. A job that is neither completed nor rescheduled in that time
   * (the process died mid-send) becomes due again.
   */
  claim(limit: number, leaseMs: number): Promise<Job[]>
  complete(jobId: string): Promise<void>
  retryAt(jobId: string, at: Date, error: string): Promise<void>
  /**
   * Jobs waiting, in flight or scheduled for a retry.
   */
  queueDepth(): Promise<number>
  /**
   * Drops expired jobs and notification ids older than `receiptTtlMs`.
   */
  cleanUp(receiptTtlMs: number): Promise<void>

  ping(): Promise<void>
  close(): Promise<void>
}

/**
 * Outcome of a single send to Apple or Google.
 */
export type SendResult =
  | {ok: true}
  | {
      ok: false
      /**
       * The provider says this token will never work again.
       */
      invalidToken: boolean
      /**
       * Worth trying again later (rate limits, outages, dropped
       * connections).
       */
      retryable: boolean
      reason: string
      invalidSince?: Date
    }
