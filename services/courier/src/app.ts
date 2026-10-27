import {createHash, timingSafeEqual} from 'node:crypto'
import http from 'node:http'
import http2 from 'node:http2'
import {type AddressInfo, type Socket} from 'node:net'

import {
  Code,
  ConnectError,
  type ConnectRouter,
  type Interceptor,
} from '@connectrpc/connect'
import {
  connectNodeAdapter,
  type ConnectNodeAdapterOptions,
} from '@connectrpc/connect-node'
import {type Logger} from 'pino'

import {type Config} from './config.ts'
import {Deliverer, type Send, type Senders} from './deliver.ts'
import {Dispatcher} from './dispatcher.ts'
import {AppPlatform, type Notification, Service} from './gen/courier_pb.js'
import {createMetrics, type Metrics} from './metrics.ts'
import {RecentIds} from './recentIds.ts'
import {type Platform, type TokenStore} from './types.ts'

export type CourierOptions = {
  config: Omit<Config, 'databaseUrl' | 'apns' | 'fcm'>
  store: TokenStore
  senders: Senders
  logger: Logger
  defaultMetrics?: boolean
  retryDelaysMs?: number[]
}

const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]{1,2000}$/
const TOKEN_FORMATS: Record<Platform, RegExp> = {
  ios: /^[0-9a-fA-F]{32,512}$/,
  android: /^[A-Za-z0-9_:-]{32,4096}$/,
}
const DRAIN_TIMEOUT_MS = 10_000

type FallbackHandler = NonNullable<ConnectNodeAdapterOptions['fallback']>
type NodeServerRequest = Parameters<FallbackHandler>[0]
type NodeServerResponse = Parameters<FallbackHandler>[1]

/**
 * The push service behind the AppView: keeps device tokens and delivers the
 * AppView's notifications to them. Speaks the AppView's `courier.Service`
 * protocol (Connect, the gRPC-compatible RPC the AppView's client uses).
 */
export class Courier {
  readonly metrics: Metrics
  private options: CourierOptions
  private dispatcher: Dispatcher<Send>
  private recentIds = new RecentIds({
    maxSize: 200_000,
    ttlMs: 24 * 60 * 60 * 1000,
  })
  private server?: http.Server | http2.Http2Server
  private sockets = new Set<Socket>()

  constructor(options: CourierOptions) {
    this.options = options
    this.metrics = createMetrics({
      defaultMetrics: options.defaultMetrics ?? false,
    })
    const deliverer = new Deliverer({
      senders: options.senders,
      store: options.store,
      metrics: this.metrics,
      logger: options.logger,
      generic: {
        title: options.config.genericTitle,
        message: options.config.genericMessage,
      },
      ttlSeconds: options.config.ttlSeconds,
      retryDelaysMs: options.retryDelaysMs,
    })
    this.dispatcher = new Dispatcher({
      concurrency: options.config.sendConcurrency,
      maxQueued: options.config.maxQueuedSends,
      work: send => deliverer.deliver(send),
      onError: err => options.logger.error({err}, 'delivery crashed'),
    })
  }

  async listen(): Promise<AddressInfo> {
    const {config} = this.options
    const handler = connectNodeAdapter({
      routes: router => this.routes(router),
      interceptors: [requireApiKey(config.apiKeys)],
      fallback: (req, res) => {
        this.fallback(req, res).catch(err => {
          this.options.logger.error({err}, 'fallback route failed')
          res.statusCode = 500
          res.end()
        })
      },
    })
    const server =
      config.httpVersion === '2'
        ? http2.createServer(handler)
        : http.createServer(handler)
    server.on('connection', (socket: Socket) => {
      this.sockets.add(socket)
      socket.on('close', () => this.sockets.delete(socket))
    })
    this.server = server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(config.port, config.host, () => {
        server.off('error', reject)
        resolve()
      })
    })
    return server.address() as AddressInfo
  }

  /**
   * Stops taking requests, gives queued sends a moment to finish, then
   * releases connections, senders and the store.
   */
  async close(drainTimeoutMs = DRAIN_TIMEOUT_MS): Promise<void> {
    const server = this.server
    const closed = server
      ? new Promise<void>(resolve => server.close(() => resolve()))
      : Promise.resolve()
    await this.dispatcher.drain(drainTimeoutMs)
    for (const socket of this.sockets) socket.destroy()
    await closed
    this.options.senders.apns?.close()
    await this.options.store.close()
  }

  private routes(router: ConnectRouter): void {
    const {store, logger, config} = this.options
    const metrics = this.metrics
    router.service(Service, {
      ping: () => ({}),

      registerDeviceToken: async req => {
        const platform = toPlatform(req.platform)
        if (!DID.test(req.did)) {
          throw new ConnectError('invalid did', Code.InvalidArgument)
        }
        if (!config.appIds.includes(req.appId)) {
          throw new ConnectError(
            `unknown app id "${req.appId}"`,
            Code.InvalidArgument,
          )
        }
        if (!TOKEN_FORMATS[platform].test(req.token)) {
          throw new ConnectError(
            `malformed ${platform} token`,
            Code.InvalidArgument,
          )
        }
        await store.register({
          did: req.did,
          token: req.token,
          appId: req.appId,
          platform,
          ageRestricted: req.ageRestricted,
        })
        metrics.registrations.inc({platform})
        logger.debug({did: req.did, platform}, 'registered device')
        return {}
      },

      unregisterDeviceToken: async req => {
        await store.unregister({
          did: req.did,
          token: req.token,
          appId: req.appId,
        })
        return {}
      },

      setAgeRestricted: async req => {
        await store.setAgeRestricted(req.did, req.ageRestricted)
        return {}
      },

      pushNotifications: async req => {
        const fresh: Notification[] = []
        const batchIds = new Set<string>()
        for (const notification of req.notifications) {
          const {id} = notification
          if (notification.clientControlled) {
            /*
             * Client-controlled pushes (the AppView's "mark read" sync) carry
             * no text. mu has no handler for them, and Android would show
             * them as blank notifications.
             */
            metrics.notifications.inc({outcome: 'client_controlled'})
          } else if (id && (batchIds.has(id) || this.recentIds.has(id))) {
            metrics.notifications.inc({outcome: 'duplicate'})
          } else if (DID.test(notification.recipientDid)) {
            if (id) batchIds.add(id)
            fresh.push(notification)
          } else {
            metrics.notifications.inc({outcome: 'invalid'})
          }
        }
        if (fresh.length === 0) return {}

        const devices = await store.devicesFor([
          ...new Set(fresh.map(n => n.recipientDid)),
        ])
        const sends: Send[] = fresh.flatMap(notification =>
          devices
            .filter(device => device.did === notification.recipientDid)
            .map(device => ({device, notification})),
        )
        if (!this.dispatcher.tryEnqueue(sends)) {
          metrics.notifications.inc({outcome: 'over_capacity'}, fresh.length)
          logger.warn(
            {notifications: fresh.length, sends: sends.length},
            'send queue full, AppView will retry',
          )
          throw new ConnectError('send queue full', Code.ResourceExhausted)
        }
        for (const notification of fresh) {
          if (notification.id) this.recentIds.add(notification.id)
        }
        metrics.notifications.inc({outcome: 'accepted'}, fresh.length)
        return {}
      },
    })
  }

  private async fallback(
    req: NodeServerRequest,
    res: NodeServerResponse,
  ): Promise<void> {
    const path = (req.url ?? '').split('?')[0]
    if (req.method === 'GET' && path === '/_health') {
      let healthy = true
      try {
        await this.options.store.ping()
      } catch {
        healthy = false
      }
      res.statusCode = healthy ? 200 : 503
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({status: healthy ? 'ok' : 'database unavailable'}))
      return
    }
    if (req.method === 'GET' && path === '/metrics') {
      this.metrics.queueDepth.set(this.dispatcher.size)
      res.statusCode = 200
      res.setHeader('content-type', this.metrics.registry.contentType)
      res.end(await this.metrics.registry.metrics())
      return
    }
    res.statusCode = 404
    res.end()
  }
}

function toPlatform(platform: AppPlatform): Platform {
  switch (platform) {
    case AppPlatform.IOS:
      return 'ios'
    case AppPlatform.ANDROID:
      return 'android'
    case AppPlatform.WEB:
      throw new ConnectError('web push is not supported', Code.InvalidArgument)
    default:
      throw new ConnectError('unknown platform', Code.InvalidArgument)
  }
}

/**
 * Accepts `Authorization: Bearer <key>` for any configured key. Digests are
 * compared so the check takes the same time whatever the key length.
 */
function requireApiKey(keys: string[]): Interceptor {
  const digests = keys.map(sha256)
  return next => async req => {
    const header = req.header.get('authorization') ?? ''
    const presented = sha256(
      header.startsWith('Bearer ') ? header.slice(7) : '',
    )
    if (!digests.some(digest => timingSafeEqual(digest, presented))) {
      throw new ConnectError('unauthorized', Code.Unauthenticated)
    }
    return next(req)
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}
