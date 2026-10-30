import {create} from '@bufbuild/protobuf'
import {timestampFromDate} from '@bufbuild/protobuf/wkt'
import {pino} from 'pino'

import {type ApnsRequest} from './apns.ts'
import {acceptOnce, groupByDid} from './db.ts'
import {type Senders} from './deliver.ts'
import {type FcmRequest} from './fcm.ts'
import {type Notification, NotificationSchema} from './gen/courier_pb.js'
import {
  type Device,
  type EnqueueResult,
  type Incoming,
  type Job,
  type SendResult,
  type Store,
} from './types.ts'

export const silentLogger = pino({level: 'silent'})

export const IOS_TOKEN = 'a1'.repeat(32)
export const ANDROID_TOKEN = 'fcm-token_' + 'x'.repeat(140) + ':APA91b'

/**
 * A notification shaped like the ones the AppView's push bridge sends.
 */
export function bridgeNotification(
  overrides: Partial<Omit<Notification, '$typeName'>> = {},
): Notification {
  const recipientDid = overrides.recipientDid ?? 'did:plc:recipient'
  return create(NotificationSchema, {
    id: 'notif-1',
    recipientDid,
    title: 'Alice',
    message: 'replied: nice photo',
    collapseKey: 'reply',
    timestamp: timestampFromDate(new Date()),
    additional: {
      reason: 'reply',
      uri: 'at://did:plc:alice/app.bsky.feed.post/3reply',
      cid: 'bafyreply',
      subject: `at://${recipientDid}/app.bsky.feed.post/3post`,
      recipientDid,
      actorDid: 'did:plc:alice',
    },
    ...overrides,
  })
}

/**
 * The Postgres store's behaviour in memory: registrations, receipts and the
 * send queue with leases.
 */
export class MemoryStore implements Store {
  devices: (Device & {updatedAt: Date})[] = []
  jobs: (Job & {nextAttemptAt: number; lastError?: string})[] = []
  receipts = new Map<string, number>()
  closed = false
  failing = false
  private nextJobId = 1

  async register(device: Device): Promise<void> {
    this.check()
    this.devices = this.devices.filter(d => !sameRegistration(d, device))
    this.devices.push({...device, updatedAt: new Date()})
  }

  async unregister(
    device: Pick<Device, 'did' | 'token' | 'appId'>,
  ): Promise<void> {
    this.check()
    this.devices = this.devices.filter(d => !sameRegistration(d, device))
  }

  async setAgeRestricted(did: string, ageRestricted: boolean): Promise<void> {
    this.check()
    for (const d of this.devices) {
      if (d.did === did) d.ageRestricted = ageRestricted
    }
  }

  async devicesFor(dids: string[]): Promise<Device[]> {
    this.check()
    return this.devices
      .filter(d => dids.includes(d.did))
      .map(({updatedAt: _, ...device}) => device)
  }

  async removeToken(token: string, invalidSince?: Date): Promise<number> {
    this.check()
    const before = this.devices.length
    this.devices = this.devices.filter(
      d => d.token !== token || (invalidSince && d.updatedAt > invalidSince),
    )
    return before - this.devices.length
  }

  async enqueue(
    incoming: Incoming[],
    maxQueued: number,
  ): Promise<EnqueueResult> {
    this.check()
    const devicesByDid = groupByDid(
      await this.devicesFor(incoming.map(i => i.notification.recipientDid)),
    )
    const withDevices = incoming.filter(i =>
      devicesByDid.has(i.notification.recipientDid),
    )
    const fresh = new Set(
      withDevices
        .map(i => i.notification.id)
        .filter(id => id && !this.receipts.has(id)),
    )
    const accepted = acceptOnce(withDevices, fresh)
    const jobs = accepted.flatMap(item =>
      (devicesByDid.get(item.notification.recipientDid) ?? []).map(device => ({
        item,
        device,
      })),
    )
    if (jobs.length > 0 && this.jobs.length + jobs.length > maxQueued) {
      return {full: true}
    }
    const now = Date.now()
    for (const {notification} of accepted) {
      if (notification.id) this.receipts.set(notification.id, now)
    }
    for (const {item, device} of jobs) {
      this.jobs.push({
        id: String(this.nextJobId++),
        device,
        notification: item.notification,
        attempts: 0,
        expiresAt: item.expiresAt,
        nextAttemptAt: now,
      })
    }
    return {
      full: false,
      accepted: accepted.length,
      duplicates: withDevices.length - accepted.length,
      noDevice: incoming.length - withDevices.length,
      jobs: jobs.length,
    }
  }

  async claim(limit: number, leaseMs: number): Promise<Job[]> {
    this.check()
    const now = Date.now()
    const due = this.jobs
      .filter(j => j.nextAttemptAt <= now)
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
      .slice(0, Math.max(0, limit))
    return due.map(job => {
      job.nextAttemptAt = now + leaseMs
      job.attempts++
      const {nextAttemptAt: _, lastError: __, ...claimed} = job
      return claimed
    })
  }

  async complete(jobId: string): Promise<void> {
    this.check()
    this.jobs = this.jobs.filter(j => j.id !== jobId)
  }

  async retryAt(jobId: string, at: Date, error: string): Promise<void> {
    this.check()
    const job = this.jobs.find(j => j.id === jobId)
    if (job) {
      job.nextAttemptAt = at.getTime()
      job.lastError = error
    }
  }

  async queueDepth(): Promise<number> {
    this.check()
    return this.jobs.length
  }

  async cleanUp(receiptTtlMs: number): Promise<void> {
    this.check()
    const now = Date.now()
    this.jobs = this.jobs.filter(j => j.expiresAt.getTime() > now)
    for (const [id, receivedAt] of this.receipts) {
      if (receivedAt < now - receiptTtlMs) this.receipts.delete(id)
    }
  }

  async ping(): Promise<void> {
    this.check()
  }

  async close(): Promise<void> {
    this.closed = true
  }

  private check() {
    if (this.failing) throw new Error('database unavailable')
  }
}

function sameRegistration(
  a: Pick<Device, 'did' | 'token' | 'appId'>,
  b: Pick<Device, 'did' | 'token' | 'appId'>,
) {
  return a.did === b.did && a.token === b.token && a.appId === b.appId
}

/**
 * Records every send and answers from a queue of scripted results (success
 * once the queue is empty).
 */
export class FakeSenders implements Senders {
  apnsRequests: ApnsRequest[] = []
  fcmRequests: FcmRequest[] = []
  apnsResults: SendResult[] = []
  fcmResults: SendResult[] = []
  apnsClosed = false

  apns = {
    send: async (request: ApnsRequest): Promise<SendResult> => {
      this.apnsRequests.push(request)
      return this.apnsResults.shift() ?? {ok: true}
    },
    close: () => {
      this.apnsClosed = true
    },
  }

  fcm = {
    send: async (request: FcmRequest): Promise<SendResult> => {
      this.fcmRequests.push(request)
      return this.fcmResults.shift() ?? {ok: true}
    },
  }
}

/**
 * Resolves once `check` passes, polling briefly; delivery runs after the RPC
 * has already answered.
 */
export async function eventually(
  check: () => boolean,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
