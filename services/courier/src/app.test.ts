import assert from 'node:assert/strict'
import {afterEach, describe, it} from 'node:test'

import {timestampFromDate} from '@bufbuild/protobuf/wkt'
import {
  Code,
  ConnectError,
  createClient,
  type Interceptor,
} from '@connectrpc/connect'
import {createConnectTransport} from '@connectrpc/connect-node'

import {Courier, type CourierOptions} from './app.ts'
import {type Senders} from './deliver.ts'
import {AppPlatform, Service} from './gen/courier_pb.js'
import {
  ANDROID_TOKEN,
  bridgeNotification,
  eventually,
  FakeSenders,
  IOS_TOKEN,
  MemoryStore,
  silentLogger,
} from './testing.ts'

const API_KEY = 'courier-test-key'

const baseConfig: CourierOptions['config'] = {
  host: '127.0.0.1',
  port: 0,
  httpVersion: '1.1',
  apiKeys: [API_KEY, 'next-key'],
  appIds: ['social.mu.app'],
  genericTitle: 'mu',
  genericMessage: 'You have a new notification',
  ttlSeconds: 24 * 60 * 60,
  sendConcurrency: 4,
  maxQueuedSends: 100,
}

function bearer(key: string): Interceptor {
  return next => req => {
    req.header.set('authorization', `Bearer ${key}`)
    return next(req)
  }
}

let running: Courier | undefined

afterEach(async () => {
  await running?.close(100)
  running = undefined
})

/**
 * Starts a courier and a client like the AppView's (Connect protocol, binary
 * messages by default).
 */
async function start({
  config = {},
  senders = new FakeSenders(),
  store = new MemoryStore(),
  key = API_KEY,
  useBinaryFormat = true,
  worker = {},
}: {
  config?: Partial<CourierOptions['config']>
  senders?: Senders
  store?: MemoryStore
  key?: string
  useBinaryFormat?: boolean
  worker?: CourierOptions['worker']
} = {}) {
  const courier = new Courier({
    config: {...baseConfig, ...config},
    store,
    senders,
    logger: silentLogger,
    worker: {pollMs: 5, leaseMs: 200, retryDelayMs: () => 1, ...worker},
  })
  running = courier
  const {port} = await courier.listen()
  const httpVersion = config.httpVersion ?? '1.1'
  const baseUrl = `http://127.0.0.1:${port}`
  const client = createClient(
    Service,
    createConnectTransport({
      baseUrl,
      httpVersion,
      useBinaryFormat,
      interceptors: [bearer(key)],
    }),
  )
  return {courier, client, store, senders, baseUrl}
}

function registration(
  overrides: Partial<{
    did: string
    token: string
    appId: string
    platform: AppPlatform
    ageRestricted: boolean
  }> = {},
) {
  return {
    did: 'did:plc:recipient',
    token: IOS_TOKEN,
    appId: 'social.mu.app',
    platform: AppPlatform.IOS,
    ageRestricted: false,
    ...overrides,
  }
}

async function rejects(promise: Promise<unknown>, code: Code) {
  await assert.rejects(promise, err => {
    assert.ok(err instanceof ConnectError)
    assert.equal(err.code, code)
    return true
  })
}

describe('authentication', () => {
  it('refuses calls without the API key', async () => {
    const {client} = await start({key: 'wrong'})
    await rejects(client.ping({}), Code.Unauthenticated)
  })

  it('accepts every configured key, so keys can be rotated', async () => {
    const {client} = await start({key: 'next-key'})
    await client.ping({})
  })
})

describe('registerDeviceToken', () => {
  it('stores the device', async () => {
    const {client, store} = await start()
    await client.registerDeviceToken(registration({ageRestricted: true}))
    assert.deepEqual(await store.devicesFor(['did:plc:recipient']), [
      {
        did: 'did:plc:recipient',
        token: IOS_TOKEN,
        appId: 'social.mu.app',
        platform: 'ios',
        ageRestricted: true,
      },
    ])
  })

  it('refuses app ids it cannot deliver for', async () => {
    const {client} = await start()
    await rejects(
      client.registerDeviceToken(registration({appId: 'xyz.blueskyweb.app'})),
      Code.InvalidArgument,
    )
  })

  it('refuses web push', async () => {
    const {client} = await start()
    await rejects(
      client.registerDeviceToken(registration({platform: AppPlatform.WEB})),
      Code.InvalidArgument,
    )
  })

  it('refuses malformed tokens and dids', async () => {
    const {client, store} = await start()
    await rejects(
      client.registerDeviceToken(registration({token: 'nothex'})),
      Code.InvalidArgument,
    )
    await rejects(
      client.registerDeviceToken(registration({did: 'alice'})),
      Code.InvalidArgument,
    )
    assert.equal(store.devices.length, 0)
  })
})

describe('pushNotifications', () => {
  it('delivers to the recipient iPhone and Android device', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders})
    await client.registerDeviceToken(registration())
    await client.registerDeviceToken(
      registration({token: ANDROID_TOKEN, platform: AppPlatform.ANDROID}),
    )

    const notification = bridgeNotification()
    await client.pushNotifications({notifications: [notification]})
    await eventually(
      () =>
        senders.apnsRequests.length === 1 && senders.fcmRequests.length === 1,
    )

    const [apns] = senders.apnsRequests
    assert.equal(apns?.token, IOS_TOKEN)
    assert.equal(apns?.topic, 'social.mu.app')
    assert.equal(apns?.pushType, 'alert')
    assert.deepEqual(apns?.payload.aps, {
      alert: {title: 'Alice', body: 'replied: nice photo'},
      'mutable-content': 1,
      sound: 'default',
    })
    assert.equal(apns?.payload.recipientDid, 'did:plc:recipient')

    const [fcm] = senders.fcmRequests
    assert.equal(fcm?.token, ANDROID_TOKEN)
    assert.equal(fcm?.priority, 'HIGH')
    assert.equal(fcm?.data.reason, 'reply')
    assert.deepEqual(JSON.parse(fcm!.data.body!), notification.additional)
  })

  it('only reaches devices of the recipient account', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders})
    await client.registerDeviceToken(registration())
    // The same phone also signed in to a second account.
    await client.registerDeviceToken(registration({did: 'did:plc:other'}))
    await client.registerDeviceToken(
      registration({did: 'did:plc:other', token: 'b2'.repeat(32)}),
    )

    await client.pushNotifications({notifications: [bridgeNotification()]})
    await eventually(() => senders.apnsRequests.length >= 1)
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(senders.apnsRequests.length, 1)
    assert.equal(
      senders.apnsRequests[0]?.payload.recipientDid,
      'did:plc:recipient',
    )
  })

  it('pushes a retried batch only once', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders})
    await client.registerDeviceToken(registration())
    const notification = bridgeNotification()
    await client.pushNotifications({
      notifications: [notification, notification],
    })
    await client.pushNotifications({notifications: [notification]})
    await eventually(() => senders.apnsRequests.length >= 1)
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(senders.apnsRequests.length, 1)
  })

  it('sends the "mark read" sync silently to every device', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders})
    await client.registerDeviceToken(registration())
    await client.registerDeviceToken(
      registration({token: ANDROID_TOKEN, platform: AppPlatform.ANDROID}),
    )
    await client.pushNotifications({
      notifications: [
        bridgeNotification({
          id: 'mark-read',
          clientControlled: true,
          title: '',
          message: '',
          collapseKey: 'mark-read-generic',
          additional: {reason: 'mark-read-generic'},
        }),
      ],
    })
    await eventually(
      () =>
        senders.apnsRequests.length === 1 && senders.fcmRequests.length === 1,
    )
    const [apns] = senders.apnsRequests
    assert.equal(apns?.pushType, 'background')
    assert.deepEqual(apns?.payload.aps, {'content-available': 1})
    assert.equal(apns?.payload.recipientDid, 'did:plc:recipient')
    const [fcm] = senders.fcmRequests
    assert.equal(fcm?.priority, 'NORMAL')
    assert.equal(fcm?.collapseKey, 'mark-read-generic')
    assert.equal(fcm?.data.title, undefined)
  })

  it('shows generic text to age-restricted accounts until lifted', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders})
    await client.registerDeviceToken(registration({ageRestricted: true}))

    await client.pushNotifications({
      notifications: [bridgeNotification({id: 'one'})],
    })
    await eventually(() => senders.apnsRequests.length === 1)
    assert.deepEqual(
      (senders.apnsRequests[0]?.payload.aps as {alert: unknown}).alert,
      {title: 'mu', body: 'You have a new notification'},
    )

    await client.setAgeRestricted({
      did: 'did:plc:recipient',
      ageRestricted: false,
    })
    await client.pushNotifications({
      notifications: [bridgeNotification({id: 'two'})],
    })
    await eventually(() => senders.apnsRequests.length === 2)
    assert.deepEqual(
      (senders.apnsRequests[1]?.payload.aps as {alert: unknown}).alert,
      {title: 'Alice', body: 'replied: nice photo'},
    )
  })

  it('stops pushing after the app unregisters', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders})
    await client.registerDeviceToken(registration())
    await client.unregisterDeviceToken(registration())
    await client.pushNotifications({notifications: [bridgeNotification()]})
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(senders.apnsRequests.length, 0)
  })

  it('forgets a token Apple calls dead, for every account on the device', async () => {
    const senders = new FakeSenders()
    senders.apnsResults.push({
      ok: false,
      invalidToken: true,
      retryable: false,
      reason: 'Unregistered',
    })
    const {client, store} = await start({senders})
    await client.registerDeviceToken(registration())
    await client.registerDeviceToken(registration({did: 'did:plc:other'}))
    await client.pushNotifications({notifications: [bridgeNotification()]})
    await eventually(() => store.devices.length === 0)
  })

  it('retries a passing failure', async () => {
    const senders = new FakeSenders()
    senders.fcmResults.push({
      ok: false,
      invalidToken: false,
      retryable: true,
      reason: 'UNAVAILABLE',
    })
    const {client} = await start({senders})
    await client.registerDeviceToken(
      registration({token: ANDROID_TOKEN, platform: AppPlatform.ANDROID}),
    )
    await client.pushNotifications({notifications: [bridgeNotification()]})
    await eventually(() => senders.fcmRequests.length === 2)
  })

  it('drops notifications older than the time to live', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders, config: {ttlSeconds: 60}})
    await client.registerDeviceToken(registration())
    await client.pushNotifications({
      notifications: [
        bridgeNotification({
          timestamp: timestampFromDate(new Date(Date.now() - 120_000)),
        }),
      ],
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(senders.apnsRequests.length, 0)
  })

  it('turns a full queue back to the AppView and takes the retry later', async () => {
    let release = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const sent: string[] = []
    const senders: Senders = {
      apns: {
        send: async request => {
          await gate
          sent.push(String(request.payload.uri))
          return {ok: true}
        },
        close: () => {},
      },
    }
    const {client} = await start({
      senders,
      config: {maxQueuedSends: 2, sendConcurrency: 1},
    })
    await client.registerDeviceToken(registration())
    await client.registerDeviceToken(registration({token: 'b2'.repeat(32)}))

    await client.pushNotifications({
      notifications: [bridgeNotification({id: 'first'})],
    })
    const second = bridgeNotification({
      id: 'second',
      additional: {reason: 'like', uri: 'at://second'},
    })
    await rejects(
      client.pushNotifications({notifications: [second]}),
      Code.ResourceExhausted,
    )

    release()
    await eventually(() => sent.length === 2)
    // The rejected batch was not remembered, so the AppView's retry goes out.
    await client.pushNotifications({notifications: [second]})
    await eventually(
      () => sent.filter(uri => uri === 'at://second').length === 2,
    )
  })

  it('delivers a push accepted before a crash after the restart', async () => {
    const store = new MemoryStore()
    const stuck: Senders = {
      apns: {send: () => new Promise(() => {}), close: () => {}},
    }
    const first = await start({store, senders: stuck, worker: {leaseMs: 50}})
    await first.client.registerDeviceToken(registration())
    await first.client.pushNotifications({
      notifications: [bridgeNotification()],
    })
    await eventually(() => store.jobs[0]?.attempts === 1)
    // The process dies mid-send: nothing finishes the job.
    running = undefined
    await first.courier.close(10)

    const senders = new FakeSenders()
    await start({store, senders, worker: {leaseMs: 50}})
    await eventually(() => senders.apnsRequests.length === 1)
    await eventually(() => store.jobs.length === 0)
  })

  it('keeps recognising a retried batch after a restart', async () => {
    const store = new MemoryStore()
    const senders = new FakeSenders()
    const first = await start({store, senders})
    await first.client.registerDeviceToken(registration())
    await first.client.pushNotifications({
      notifications: [bridgeNotification()],
    })
    await eventually(() => senders.apnsRequests.length === 1)
    running = undefined
    await first.courier.close(100)

    const second = await start({store, senders})
    await second.client.pushNotifications({
      notifications: [bridgeNotification()],
    })
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(senders.apnsRequests.length, 1)
  })

  it('fails the call when the database is down, so the AppView retries', async () => {
    const store = new MemoryStore()
    const {client} = await start({store})
    store.failing = true
    await assert.rejects(
      client.pushNotifications({notifications: [bridgeNotification()]}),
    )
  })

  it('understands JSON messages too', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders, useBinaryFormat: false})
    await client.registerDeviceToken(registration())
    await client.pushNotifications({notifications: [bridgeNotification()]})
    await eventually(() => senders.apnsRequests.length === 1)
  })

  it('serves HTTP/2 without TLS, the AppView client default', async () => {
    const senders = new FakeSenders()
    const {client} = await start({senders, config: {httpVersion: '2'}})
    await client.registerDeviceToken(registration())
    await client.pushNotifications({notifications: [bridgeNotification()]})
    await eventually(() => senders.apnsRequests.length === 1)
  })
})

describe('operations', () => {
  it('reports health from the database', async () => {
    const store = new MemoryStore()
    const {baseUrl} = await start({store})
    assert.equal((await fetch(`${baseUrl}/_health`)).status, 200)
    store.failing = true
    assert.equal((await fetch(`${baseUrl}/_health`)).status, 503)
  })

  it('exposes delivery metrics', async () => {
    const {client, baseUrl} = await start()
    await client.registerDeviceToken(registration())
    await client.pushNotifications({notifications: [bridgeNotification()]})
    const metrics = await (await fetch(`${baseUrl}/metrics`)).text()
    assert.match(metrics, /courier_registrations_total\{platform="ios"\} 1/)
    assert.match(metrics, /courier_notifications_total\{outcome="accepted"\} 1/)
    assert.match(metrics, /courier_send_queue_depth/)
  })

  it('closes its senders and the store on shutdown', async () => {
    const senders = new FakeSenders()
    const store = new MemoryStore()
    const {courier} = await start({senders, store})
    running = undefined
    await courier.close(100)
    assert.equal(senders.apnsClosed, true)
    assert.equal(store.closed, true)
  })
})
