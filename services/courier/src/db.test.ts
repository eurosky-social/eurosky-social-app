import assert from 'node:assert/strict'
import {after, before, beforeEach, describe, it} from 'node:test'

import pg from 'pg'

import {PgTokenStore} from './db.ts'
import {ANDROID_TOKEN, IOS_TOKEN} from './testing.ts'
import {type Device} from './types.ts'

const databaseUrl = process.env.COURIER_TEST_DATABASE_URL

const iphone: Device = {
  did: 'did:plc:alice',
  token: IOS_TOKEN,
  appId: 'social.mu.app',
  platform: 'ios',
  ageRestricted: false,
}

describe(
  'PgTokenStore',
  {skip: databaseUrl ? false : 'set COURIER_TEST_DATABASE_URL'},
  () => {
    let store: PgTokenStore
    let admin: pg.Client

    before(async () => {
      admin = new pg.Client({connectionString: databaseUrl})
      await admin.connect()
      await admin.query('drop table if exists device_token, courier_migration')
      store = new PgTokenStore(databaseUrl!)
      // Two instances starting together must not both migrate.
      await Promise.all([store.migrate(), store.migrate()])
    })

    beforeEach(async () => {
      await admin.query('truncate device_token')
    })

    after(async () => {
      await store?.close()
      await admin?.end()
    })

    it('records every migration once', async () => {
      await store.migrate()
      const {rows} = await admin.query(
        'select version from courier_migration order by version',
      )
      assert.deepEqual(rows, [{version: 1}])
    })

    it('registers a device and finds it by account', async () => {
      await store.register(iphone)
      assert.deepEqual(await store.devicesFor(['did:plc:alice']), [iphone])
      assert.deepEqual(await store.devicesFor(['did:plc:bob']), [])
      assert.deepEqual(await store.devicesFor([]), [])
    })

    it('updates a repeated registration in place', async () => {
      await store.register(iphone)
      await store.register({...iphone, ageRestricted: true})
      assert.deepEqual(await store.devicesFor(['did:plc:alice']), [
        {...iphone, ageRestricted: true},
      ])
    })

    it('keeps one registration per account on a shared device', async () => {
      await store.register(iphone)
      await store.register({...iphone, did: 'did:plc:bob'})
      const devices = await store.devicesFor(['did:plc:alice', 'did:plc:bob'])
      assert.equal(devices.length, 2)
    })

    it('unregisters only the given account', async () => {
      await store.register(iphone)
      await store.register({...iphone, did: 'did:plc:bob'})
      await store.unregister(iphone)
      assert.deepEqual(
        (await store.devicesFor(['did:plc:alice', 'did:plc:bob'])).map(
          d => d.did,
        ),
        ['did:plc:bob'],
      )
    })

    it('sets the age restriction on all devices of an account', async () => {
      await store.register(iphone)
      await store.register({
        ...iphone,
        token: ANDROID_TOKEN,
        platform: 'android',
      })
      await store.setAgeRestricted('did:plc:alice', true)
      const devices = await store.devicesFor(['did:plc:alice'])
      assert.deepEqual(
        devices.map(d => d.ageRestricted),
        [true, true],
      )
    })

    it('removes a dead token for every account', async () => {
      await store.register(iphone)
      await store.register({...iphone, did: 'did:plc:bob'})
      assert.equal(await store.removeToken(IOS_TOKEN), 2)
      assert.deepEqual(
        await store.devicesFor(['did:plc:alice', 'did:plc:bob']),
        [],
      )
    })

    it('keeps a token registered again after Apple declared it dead', async () => {
      await store.register(iphone)
      const declaredDead = new Date(Date.now() - 60_000)
      assert.equal(await store.removeToken(IOS_TOKEN, declaredDead), 0)
      assert.equal(
        await store.removeToken(IOS_TOKEN, new Date(Date.now() + 60_000)),
        1,
      )
    })

    it('answers a ping', async () => {
      await store.ping()
    })
  },
)
