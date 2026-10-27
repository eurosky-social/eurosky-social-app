import pg from 'pg'

import {type Device, type Platform, type TokenStore} from './types.ts'

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
]

/**
 * Device registrations in Postgres.
 */
export class PgTokenStore implements TokenStore {
  private pool: pg.Pool

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({connectionString: databaseUrl, max: 10})
  }

  /**
   * Applies pending migrations. The advisory lock keeps two instances started
   * together from racing each other.
   */
  async migrate(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
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
      await client.query('commit')
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
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
    const {rows} = await this.pool.query<{
      did: string
      token: string
      app_id: string
      platform: Platform
      age_restricted: boolean
    }>(
      `select did, token, app_id, platform, age_restricted
       from device_token where did = any($1::text[])`,
      [dids],
    )
    return rows.map(row => ({
      did: row.did,
      token: row.token,
      appId: row.app_id,
      platform: row.platform,
      ageRestricted: row.age_restricted,
    }))
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

  async ping(): Promise<void> {
    await this.pool.query('select 1')
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
