import assert from 'node:assert/strict'
import {after, before, beforeEach, describe, it} from 'node:test'

import pg from 'pg'

import {PgStore} from './db.ts'
import {ANDROID_TOKEN, bridgeNotification, IOS_TOKEN} from './testing.ts'
import {type Device, type Incoming} from './types.ts'

const databaseUrl = process.env.COURIER_TEST_DATABASE_URL

const iphone: Device = {
  did: 'did:plc:alice',
  token: IOS_TOKEN,
  appId: 'social.mu.app',
  platform: 'ios',
  ageRestricted: false,
}

describe(
  'PgStore',
  {skip: databaseUrl ? false : 'set COURIER_TEST_DATABASE_URL'},
  () => {
    let store: PgStore
    let admin: pg.Client

    before(async () => {
      admin = new pg.Client({connectionString: databaseUrl})
      await admin.connect()
      await admin.query(
        'drop table if exists device_token, notification_receipt, push_job, courier_migration',
      )
      store = new PgStore(databaseUrl!)
      // Two instances starting together must not both migrate.
      await Promise.all([store.migrate(), store.migrate()])
    })

    beforeEach(async () => {
      await admin.query('truncate device_token, notification_receipt, push_job')
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
      assert.deepEqual(rows, [{version: 1}, {version: 2}])
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

    describe('send queue', () => {
      const inADay = () => new Date(Date.now() + 86_400_000)
      const incoming = (
        id: string,
        recipientDid = 'did:plc:alice',
      ): Incoming => ({
        notification: bridgeNotification({id, recipientDid}),
        expiresAt: inADay(),
      })

      it('queues one job per device of the recipient', async () => {
        await store.register(iphone)
        await store.register({
          ...iphone,
          token: ANDROID_TOKEN,
          platform: 'android',
        })
        await store.register({...iphone, did: 'did:plc:bob'})
        assert.deepEqual(await store.enqueue([incoming('n1')], 100), {
          full: false,
          accepted: 1,
          duplicates: 0,
          noDevice: 0,
          jobs: 2,
        })
        assert.equal(await store.queueDepth(), 2)
      })

      it('keeps the notification intact', async () => {
        await store.register(iphone)
        const item = incoming('n1')
        item.notification.clientControlled = true
        await store.enqueue([item], 100)
        const [job] = await store.claim(10, 60_000)
        assert.deepEqual(job?.notification, item.notification)
        assert.deepEqual(job?.device, iphone)
        assert.equal(job?.attempts, 1)
        assert.equal(job?.expiresAt.getTime(), item.expiresAt.getTime())
      })

      it('skips notification ids it has seen, in later and in the same batch', async () => {
        await store.register(iphone)
        await store.enqueue([incoming('n1')], 100)
        const result = await store.enqueue(
          [incoming('n1'), incoming('n2'), incoming('n2'), incoming('')],
          100,
        )
        assert.deepEqual(result, {
          full: false,
          accepted: 2,
          duplicates: 2,
          noDevice: 0,
          jobs: 2,
        })
        assert.equal(await store.queueDepth(), 3)
      })

      it('writes nothing for recipients without devices', async () => {
        await store.register(iphone)
        assert.deepEqual(
          await store.enqueue(
            [incoming('n1', 'did:plc:bob'), incoming('n2')],
            100,
          ),
          {full: false, accepted: 1, duplicates: 0, noDevice: 1, jobs: 1},
        )
        assert.deepEqual(
          await store.enqueue([incoming('n3', 'did:plc:bob')], 100),
          {full: false, accepted: 0, duplicates: 0, noDevice: 1, jobs: 0},
        )
        const {rows} = await admin.query(
          'select id from notification_receipt order by id',
        )
        assert.deepEqual(rows, [{id: 'n2'}])
      })

      it('refuses a batch past the limit and records nothing of it', async () => {
        await store.register(iphone)
        await store.enqueue([incoming('n1')], 2)
        assert.deepEqual(
          await store.enqueue([incoming('n2'), incoming('n3')], 2),
          {full: true},
        )
        assert.equal(await store.queueDepth(), 1)
        // Not marked as seen, so the AppView's retry is accepted.
        const retry = await store.enqueue([incoming('n2')], 2)
        assert.equal(retry.full === false && retry.jobs, 1)
      })

      it('hides a claimed job until its lease ends', async () => {
        await store.register(iphone)
        await store.enqueue([incoming('n1')], 100)
        assert.equal((await store.claim(10, 200)).length, 1)
        assert.equal((await store.claim(10, 200)).length, 0)
        await new Promise(resolve => setTimeout(resolve, 250))
        const [again] = await store.claim(10, 200)
        assert.equal(again?.attempts, 2)
      })

      it('never hands one job to two claimers', async () => {
        await store.register(iphone)
        await store.enqueue(
          Array.from({length: 20}, (_, i) => incoming(`n${i}`)),
          100,
        )
        const other = new PgStore(databaseUrl!)
        try {
          const batches = await Promise.all([
            store.claim(15, 60_000),
            other.claim(15, 60_000),
          ])
          const ids = batches.flat().map(job => job.id)
          assert.equal(ids.length, 20)
          assert.equal(new Set(ids).size, 20)
        } finally {
          await other.close()
        }
      })

      it('reschedules and completes jobs', async () => {
        await store.register(iphone)
        await store.enqueue([incoming('n1'), incoming('n2')], 100)
        const [first, second] = await store.claim(10, 60_000)
        await store.retryAt(first!.id, new Date(Date.now() - 1), 'UNAVAILABLE')
        await store.complete(second!.id)
        const due = await store.claim(10, 60_000)
        assert.deepEqual(
          due.map(job => job.id),
          [first!.id],
        )
        const {rows} = await admin.query('select last_error from push_job')
        assert.deepEqual(rows, [{last_error: 'UNAVAILABLE'}])
      })

      it('cleans up expired jobs and old ids', async () => {
        await store.register(iphone)
        await store.enqueue(
          [
            {...incoming('old'), expiresAt: new Date(Date.now() + 50)},
            incoming('new'),
          ],
          100,
        )
        await admin.query(
          `update notification_receipt set received_at = now() - interval '2 days' where id = 'old'`,
        )
        await new Promise(resolve => setTimeout(resolve, 60))
        await store.cleanUp(86_400_000)
        assert.equal(await store.queueDepth(), 1)
        const {rows} = await admin.query('select id from notification_receipt')
        assert.deepEqual(rows, [{id: 'new'}])
      })
    })
  },
)
