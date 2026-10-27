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
import {timestampDate} from '@bufbuild/protobuf/wkt'
import {type Logger} from 'pino'

import {type Config} from './config.ts'
import {Deliverer, type Senders} from './deliver.ts'
import {AppPlatform, Service} from './gen/courier_pb.js'
import {createMetrics, type Metrics} from './metrics.ts'
import {type Incoming, type Platform, type Store} from './types.ts'
import {Worker} from './worker.ts'

export type CourierOptions = {
  config: Omit<Config, 'databaseUrl' | 'apns' | 'fcm'>
  store: Store
  senders: Senders
  logger: Logger
  defaultMetrics?: boolean
  /**
   * Overrides for tests; see Worker.
   */
  worker?: {
    pollMs?: number
    leaseMs?: number
    retryDelayMs?: (attempts: number) => number
  }
}

const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]{1,2000}$/
const TOKEN_FORMATS: Record<Platform, RegExp> = {
  ios: /^[0-9a-fA-F]{32,512}$/,
  android: /^[A-Za-z0-9_:-]{32,4096}$/,
}
const DRAIN_TIMEOUT_MS = 10_000
/**
 * The AppView retries a batch for up to a day, so ids are remembered that long.
 */
const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000

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
  private worker: Worker
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
    })
    this.worker = new Worker({
      store: options.store,
      deliverer,
      metrics: this.metrics,
      logger: options.logger,
      concurrency: options.config.sendConcurrency,
      receiptTtlMs: RECEIPT_TTL_MS,
      ...options.worker,
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
    // Also picks up jobs left from before a restart.
    this.worker.start()
    return server.address() as AddressInfo
  }

  /**
   * Stops taking requests and claiming jobs, gives sends in flight a moment
   * to finish, then releases connections, senders and the store. Queued jobs
   * stay in the store for the next start.
   */
  async close(drainTimeoutMs = DRAIN_TIMEOUT_MS): Promise<void> {
    const server = this.server
    const closed = server
      ? new Promise<void>(resolve => server.close(() => resolve()))
      : Promise.resolve()
    await this.worker.stop(drainTimeoutMs)
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
        const now = Date.now()
        const incoming: Incoming[] = []
        for (const notification of req.notifications) {
          if (!DID.test(notification.recipientDid)) {
            metrics.notifications.inc({outcome: 'invalid'})
            continue
          }
          const createdAt = notification.timestamp
            ? timestampDate(notification.timestamp).getTime()
            : now
          const expiresAt = new Date(createdAt + config.ttlSeconds * 1000)
          // Stale, e.g. after a long AppView retry or an indexer backfill.
          if (expiresAt.getTime() <= now) {
            metrics.notifications.inc({outcome: 'expired'})
            continue
          }
          incoming.push({notification, expiresAt})
        }
        if (incoming.length === 0) return {}

        // Saved before answering: once accepted, a push survives a restart.
        const result = await store.enqueue(incoming, config.maxQueuedSends)
        if (result.full) {
          metrics.notifications.inc({outcome: 'over_capacity'}, incoming.length)
          logger.warn(
            {notifications: incoming.length},
            'send queue full, AppView will retry',
          )
          throw new ConnectError('send queue full', Code.ResourceExhausted)
        }
        metrics.notifications.inc({outcome: 'accepted'}, result.accepted)
        metrics.notifications.inc({outcome: 'duplicate'}, result.duplicates)
        if (result.jobs > 0) this.worker.wake()
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
      this.metrics.queueDepth.set(await this.options.store.queueDepth())
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
