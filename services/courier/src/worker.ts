import {type Logger} from 'pino'

import {type Deliverer, type Outcome} from './deliver.ts'
import {type Metrics} from './metrics.ts'
import {type Job, type Store} from './types.ts'

/**
 * Delay before attempt `attempts + 1` of a job whose attempt number
 * `attempts` failed in a way worth retrying: 5 s, 20 s, 80 s, ... capped at
 * 30 minutes, so an Apple or Google outage is retried until the job expires.
 */
export function defaultRetryDelayMs(attempts: number): number {
  return Math.min(5_000 * 4 ** Math.max(0, attempts - 1), 30 * 60 * 1000)
}

const CLEAN_UP_INTERVAL_MS = 10 * 60 * 1000

/**
 * Runs the send queue: claims due jobs up to the concurrency limit, makes one
 * attempt at each, then deletes or reschedules it. Jobs live in the store, so
 * a crash or restart loses nothing; a job claimed by a process that died is
 * picked up again once its lease ends (it may then be pushed twice).
 */
export class Worker {
  private store: Store
  private deliverer: Pick<Deliverer, 'deliver'>
  private metrics: Metrics
  private logger: Logger
  private concurrency: number
  private leaseMs: number
  private pollMs: number
  private receiptTtlMs: number
  private retryDelayMs: (attempts: number) => number
  private active = 0
  private running = false
  private loop?: Promise<void>
  private wakeUp?: () => void
  /**
   * Set when a wake-up came while the worker was busy, so the next sleep is
   * skipped instead of missing it.
   */
  private woken = false
  private idleWaiters: (() => void)[] = []
  private lastCleanUp = 0

  constructor({
    store,
    deliverer,
    metrics,
    logger,
    concurrency,
    receiptTtlMs,
    leaseMs = 60_000,
    pollMs = 1_000,
    retryDelayMs = defaultRetryDelayMs,
  }: {
    store: Store
    deliverer: Pick<Deliverer, 'deliver'>
    metrics: Metrics
    logger: Logger
    concurrency: number
    /**
     * How long notification ids are remembered against AppView retries.
     */
    receiptTtlMs: number
    /**
     * How long a claimed job stays hidden; longer than any single send.
     */
    leaseMs?: number
    /**
     * Longest wait between looks at the queue when nothing woke the worker.
     */
    pollMs?: number
    retryDelayMs?: (attempts: number) => number
  }) {
    this.store = store
    this.deliverer = deliverer
    this.metrics = metrics
    this.logger = logger
    this.concurrency = concurrency
    this.receiptTtlMs = receiptTtlMs
    this.leaseMs = leaseMs
    this.pollMs = pollMs
    this.retryDelayMs = retryDelayMs
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.loop = this.run()
  }

  /**
   * Looks at the queue now instead of at the next poll, e.g. after new jobs
   * were queued.
   */
  wake(): void {
    if (this.wakeUp) this.wakeUp()
    else this.woken = true
  }

  /**
   * Stops claiming, then waits up to `drainTimeoutMs` for sends in flight.
   * Jobs still unfinished after that keep their lease and are retried after
   * the next start.
   */
  async stop(drainTimeoutMs: number): Promise<void> {
    if (!this.running) return
    this.running = false
    this.wake()
    await this.loop
    if (this.active === 0) return
    let timer: NodeJS.Timeout | undefined
    await Promise.race([
      new Promise<void>(resolve => this.idleWaiters.push(resolve)),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, drainTimeoutMs)
      }),
    ])
    clearTimeout(timer)
  }

  private async run(): Promise<void> {
    while (this.running) {
      let claimed = 0
      const free = this.concurrency - this.active
      try {
        await this.cleanUpNowAndThen()
      } catch (err) {
        this.logger.error({err}, 'could not clean up the send queue')
      }
      try {
        if (free > 0) {
          const jobs = await this.store.claim(free, this.leaseMs)
          claimed = jobs.length
          for (const job of jobs) this.process(job)
        }
      } catch (err) {
        this.logger.error({err}, 'could not read the send queue')
      }
      // A full batch suggests more is due; otherwise wait for news.
      if (claimed > 0 && claimed === free) continue
      await this.sleep()
    }
  }

  private sleep(): Promise<void> {
    if (this.woken) {
      this.woken = false
      return Promise.resolve()
    }
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer)
        this.wakeUp = undefined
        resolve()
      }
      const timer = setTimeout(done, this.pollMs)
      this.wakeUp = done
    })
  }

  private process(job: Job): void {
    this.active++
    this.attempt(job)
      .catch(err => this.logger.error({err, jobId: job.id}, 'job crashed'))
      .finally(() => {
        this.active--
        if (this.active === 0) {
          for (const resolve of this.idleWaiters.splice(0)) resolve()
        }
        // A slot is free again.
        this.wake()
      })
  }

  private async attempt(job: Job): Promise<void> {
    let outcome: Outcome
    try {
      outcome = await this.deliverer.deliver(job)
    } catch (err) {
      outcome = {kind: 'retry', reason: errorMessage(err)}
    }

    if (outcome.kind === 'retry') {
      const at = new Date(Date.now() + this.retryDelayMs(job.attempts))
      if (at < job.expiresAt) {
        this.count(job, 'retry')
        await this.store.retryAt(job.id, at, outcome.reason)
        return
      }
      outcome = {kind: 'failed', reason: `${outcome.reason} (expired)`}
    }

    this.count(job, outcome.kind)
    if (outcome.kind === 'failed') {
      this.logger.warn(
        {
          platform: job.device.platform,
          did: job.device.did,
          notificationId: job.notification.id,
          reason: outcome.reason,
          attempts: job.attempts,
        },
        'push not delivered',
      )
    }
    await this.store.complete(job.id)
  }

  private count(job: Job, outcome: string): void {
    this.metrics.deliveries.inc({
      platform: job.device.platform,
      kind: job.notification.clientControlled ? 'silent' : 'alert',
      outcome,
    })
  }

  private async cleanUpNowAndThen(): Promise<void> {
    if (Date.now() - this.lastCleanUp < CLEAN_UP_INTERVAL_MS) return
    this.lastCleanUp = Date.now()
    await this.store.cleanUp(this.receiptTtlMs)
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
