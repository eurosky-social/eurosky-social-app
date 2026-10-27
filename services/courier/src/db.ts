import {fromJson, type JsonValue, toJson} from '@bufbuild/protobuf'
import pg from 'pg'

import {NotificationSchema} from './gen/courier_pb.js'
import {
  type Device,
  type EnqueueResult,
  type Incoming,
  type Job,
  type Platform,
  type Store,
} from './types.ts'

/**
 * Schema changes, applied in order and recorded in `courier_migration`. Never
 * edit an entry once it has shipped; append a new one.
 */
const MIGRATIONS = [
  `
  create table device_token (
    did text not null,
    token text not null,
    app_id text not null,
    platform text not null check (platform in ('ios', 'android')),
    age_restricted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (did, token, app_id)
  );
  create index device_token_token_idx on device_token (token);
  `,
  `
  create table notification_receipt (
    id text primary key,
    received_at timestamptz not null default now()
  );
  create index notification_receipt_received_at_idx
    on notification_receipt (received_at);

  create table push_job (
    id bigserial primary key,
    notification_id text not null,
    notification jsonb not null,
    did text not null,
    token text not null,
    app_id text not null,
    platform text not null check (platform in ('ios', 'android')),
    age_restricted boolean not null,
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    expires_at timestamptz not null,
    last_error text,
    created_at timestamptz not null default now()
  );
  create index push_job_next_attempt_at_idx on push_job (next_attempt_at);
  create index push_job_expires_at_idx on push_job (expires_at);
  `,
]

type DeviceRow = {
  did: string
  token: string
  app_id: string
  platform: Platform
  age_restricted: boolean
}

type JobRow = DeviceRow & {
  id: string
  notification: JsonValue
  attempts: number
  expires_at: Date
}

/**
 * Device registrations and the send queue in Postgres.
 */
export class PgStore implements Store {
  private pool: pg.Pool

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({connectionString: databaseUrl, max: 10})
  }

  /**
   * Applies pending migrations. The advisory lock keeps two instances started
   * together from racing each other.
   */
  async migrate(): Promise<void> {
    await this.transaction(async client => {
      await client.query(`select pg_advisory_xact_lock(hashtext('courier'))`)
      await client.query(
        `create table if not exists courier_migration (
          version integer primary key,
          applied_at timestamptz not null default now()
        )`,
      )
      const {rows} = await client.query<{version: number}>(
        'select coalesce(max(version), 0) as version from courier_migration',
      )
      const current = rows[0]?.version ?? 0
      for (let version = current + 1; version <= MIGRATIONS.length; version++) {
        await client.query(MIGRATIONS[version - 1]!)
        await client.query(
          'insert into courier_migration (version) values ($1)',
          [version],
        )
      }
    })
  }

  async register(device: Device): Promise<void> {
    await this.pool.query(
      `insert into device_token (did, token, app_id, platform, age_restricted)
       values ($1, $2, $3, $4, $5)
       on conflict (did, token, app_id) do update set
         platform = excluded.platform,
         age_restricted = excluded.age_restricted,
         updated_at = now()`,
      [
        device.did,
        device.token,
        device.appId,
        device.platform,
        device.ageRestricted,
      ],
    )
  }

  async unregister({
    did,
    token,
    appId,
  }: Pick<Device, 'did' | 'token' | 'appId'>): Promise<void> {
    await this.pool.query(
      'delete from device_token where did = $1 and token = $2 and app_id = $3',
      [did, token, appId],
    )
  }

  async setAgeRestricted(did: string, ageRestricted: boolean): Promise<void> {
    await this.pool.query(
      `update device_token set age_restricted = $2, updated_at = now()
       where did = $1 and age_restricted <> $2`,
      [did, ageRestricted],
    )
  }

  async devicesFor(dids: string[]): Promise<Device[]> {
    if (dids.length === 0) return []
    const {rows} = await this.pool.query<DeviceRow>(
      `select did, token, app_id, platform, age_restricted
       from device_token where did = any($1::text[])`,
      [dids],
    )
    return rows.map(toDevice)
  }

  async removeToken(token: string, invalidSince?: Date): Promise<number> {
    const result = invalidSince
      ? await this.pool.query(
          'delete from device_token where token = $1 and updated_at <= $2',
          [token, invalidSince],
        )
      : await this.pool.query('delete from device_token where token = $1', [
          token,
        ])
    return result.rowCount ?? 0
  }

  async enqueue(
    incoming: Incoming[],
    maxQueued: number,
  ): Promise<EnqueueResult> {
    try {
      return await this.enqueueInTransaction(incoming, maxQueued)
    } catch (err) {
      if (err instanceof QueueFull) return {full: true}
      throw err
    }
  }

  private enqueueInTransaction(
    incoming: Incoming[],
    maxQueued: number,
  ): Promise<EnqueueResult> {
    return this.transaction(async client => {
      const ids = [
        ...new Set(incoming.map(i => i.notification.id).filter(Boolean)),
      ]
      const {rows: fresh} = ids.length
        ? await client.query<{id: string}>(
            `insert into notification_receipt (id)
             select unnest($1::text[])
             on conflict do nothing
             returning id`,
            [ids],
          )
        : {rows: []}
      const accepted = acceptOnce(incoming, new Set(fresh.map(r => r.id)))
      const duplicates = incoming.length - accepted.length

      const {rows: deviceRows} = accepted.length
        ? await client.query<DeviceRow>(
            `select did, token, app_id, platform, age_restricted
             from device_token where did = any($1::text[])`,
            [[...new Set(accepted.map(i => i.notification.recipientDid))]],
          )
        : {rows: []}
      const jobs = accepted.flatMap(item =>
        deviceRows
          .filter(row => row.did === item.notification.recipientDid)
          .map(row => ({item, device: toDevice(row)})),
      )

      if (jobs.length > 0) {
        const {rows} = await client.query<{count: number}>(
          'select count(*)::int as count from push_job',
        )
        // Thrown so the receipts recorded above are rolled back too.
        if ((rows[0]?.count ?? 0) + jobs.length > maxQueued) {
          throw new QueueFull()
        }
        await client.query(
          `insert into push_job (notification_id, notification, did, token,
             app_id, platform, age_restricted, expires_at)
           select * from unnest($1::text[], $2::jsonb[], $3::text[],
             $4::text[], $5::text[], $6::text[], $7::boolean[],
             $8::timestamptz[])`,
          [
            jobs.map(j => j.item.notification.id),
            jobs.map(j =>
              JSON.stringify(toJson(NotificationSchema, j.item.notification)),
            ),
            jobs.map(j => j.device.did),
            jobs.map(j => j.device.token),
            jobs.map(j => j.device.appId),
            jobs.map(j => j.device.platform),
            jobs.map(j => j.device.ageRestricted),
            jobs.map(j => j.item.expiresAt),
          ],
        )
      }
      return {
        full: false,
        accepted: accepted.length,
        duplicates,
        jobs: jobs.length,
      }
    })
  }

  async claim(limit: number, leaseMs: number): Promise<Job[]> {
    if (limit <= 0) return []
    // The lease is the next attempt time: a job nobody finishes comes due again.
    const {rows} = await this.pool.query<JobRow>(
      `with due as (
         select id from push_job
         where next_attempt_at <= now()
         order by next_attempt_at
         limit $1
         for update skip locked
       )
       update push_job j set
         next_attempt_at = now() + $2::int * interval '1 millisecond',
         attempts = j.attempts + 1
       from due where j.id = due.id
       returning j.id, j.notification, j.did, j.token, j.app_id, j.platform,
         j.age_restricted, j.attempts, j.expires_at`,
      [limit, leaseMs],
    )
    return rows.map(row => ({
      id: row.id,
      device: toDevice(row),
      notification: fromJson(NotificationSchema, row.notification),
      attempts: row.attempts,
      expiresAt: row.expires_at,
    }))
  }

  async complete(jobId: string): Promise<void> {
    await this.pool.query('delete from push_job where id = $1', [jobId])
  }

  async retryAt(jobId: string, at: Date, error: string): Promise<void> {
    await this.pool.query(
      `update push_job set next_attempt_at = $2, last_error = $3
       where id = $1`,
      [jobId, at, error.slice(0, 500)],
    )
  }

  async queueDepth(): Promise<number> {
    const {rows} = await this.pool.query<{count: number}>(
      'select count(*)::int as count from push_job',
    )
    return rows[0]?.count ?? 0
  }

  async cleanUp(receiptTtlMs: number): Promise<void> {
    await this.pool.query('delete from push_job where expires_at <= now()')
    await this.pool.query(
      `delete from notification_receipt
       where received_at < now() - $1::int * interval '1 millisecond'`,
      [receiptTtlMs],
    )
  }

  async ping(): Promise<void> {
    await this.pool.query('select 1')
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  private async transaction<T>(
    work: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const result = await work(client)
      await client.query('commit')
      return result
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}

class QueueFull extends Error {}

/**
 * The items to queue: each notification id once, and only if it was not
 * received before. Items without an id cannot be de-duplicated and pass.
 */
export function acceptOnce(
  incoming: Incoming[],
  freshIds: ReadonlySet<string>,
): Incoming[] {
  const taken = new Set<string>()
  return incoming.filter(({notification: {id}}) => {
    if (!id) return true
    if (!freshIds.has(id) || taken.has(id)) return false
    taken.add(id)
    return true
  })
}

function toDevice(row: DeviceRow): Device {
  return {
    did: row.did,
    token: row.token,
    appId: row.app_id,
    platform: row.platform,
    ageRestricted: row.age_restricted,
  }
}
