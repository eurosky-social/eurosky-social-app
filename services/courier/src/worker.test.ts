import assert from 'node:assert/strict'
import {afterEach, describe, it} from 'node:test'

import {type Outcome} from './deliver.ts'
import {createMetrics} from './metrics.ts'
import {
  bridgeNotification,
  eventually,
  IOS_TOKEN,
  MemoryStore,
  silentLogger,
} from './testing.ts'
import {type Job} from './types.ts'
import {defaultRetryDelayMs, Worker} from './worker.ts'

let running: Worker | undefined

afterEach(async () => {
  await running?.stop(100)
  running = undefined
})

async function storeWithJobs(count: number, expiresInMs = 86_400_000) {
  const store = new MemoryStore()
  await store.register({
    did: 'did:plc:recipient',
    token: IOS_TOKEN,
    appId: 'social.mu.app',
    platform: 'ios',
    ageRestricted: false,
  })
  await store.enqueue(
    Array.from({length: count}, (_, i) => ({
      notification: bridgeNotification({id: `n${i}`}),
      expiresAt: new Date(Date.now() + expiresInMs),
    })),
    1_000,
  )
  return store
}

function startWorker(
  store: MemoryStore,
  deliver: (job: Job) => Promise<Outcome>,
  options: {concurrency?: number; retryDelayMs?: () => number} = {},
) {
  const metrics = createMetrics({defaultMetrics: false})
  const worker = new Worker({
    store,
    deliverer: {deliver},
    metrics,
    logger: silentLogger,
    concurrency: options.concurrency ?? 4,
    receiptTtlMs: 86_400_000,
    leaseMs: 1_000,
    pollMs: 5,
    retryDelayMs: options.retryDelayMs ?? (() => 1),
  })
  running = worker
  worker.start()
  return {worker, metrics}
}

async function counted(
  metrics: ReturnType<typeof createMetrics>,
  outcome: string,
): Promise<number> {
  const {values} = await metrics.deliveries.get()
  return values
    .filter(v => (v.labels as Record<string, unknown>).outcome === outcome)
    .reduce((sum, v) => sum + v.value, 0)
}

describe('Worker', () => {
  it('delivers queued jobs and removes them', async () => {
    const store = await storeWithJobs(3)
    const delivered: string[] = []
    const {metrics} = startWorker(store, async job => {
      delivered.push(job.notification.id)
      return {kind: 'sent'}
    })
    await eventually(() => store.jobs.length === 0)
    assert.deepEqual(delivered.sort(), ['n0', 'n1', 'n2'])
    assert.equal(await counted(metrics, 'sent'), 3)
  })

  it('runs at most `concurrency` sends at once', async () => {
    const store = await storeWithJobs(6)
    let release = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    let inFlight = 0
    let peak = 0
    startWorker(
      store,
      async () => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await gate
        inFlight--
        return {kind: 'sent'}
      },
      {concurrency: 2},
    )
    await eventually(() => inFlight === 2)
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(peak, 2)
    release()
    await eventually(() => store.jobs.length === 0)
  })

  it('schedules a passing failure for later, counting attempts', async () => {
    const store = await storeWithJobs(1)
    const attempts: number[] = []
    const {metrics} = startWorker(store, async job => {
      attempts.push(job.attempts)
      return job.attempts < 3
        ? {kind: 'retry', reason: 'UNAVAILABLE'}
        : {kind: 'sent'}
    })
    await eventually(() => store.jobs.length === 0)
    assert.deepEqual(attempts, [1, 2, 3])
    assert.equal(await counted(metrics, 'retry'), 2)
    assert.equal(await counted(metrics, 'sent'), 1)
  })

  it('waits the retry delay before the next attempt', async () => {
    const store = await storeWithJobs(1)
    startWorker(store, async () => ({kind: 'retry', reason: 'UNAVAILABLE'}), {
      retryDelayMs: () => 60_000,
    })
    await eventually(() => store.jobs[0]?.lastError === 'UNAVAILABLE')
    const job = store.jobs[0]!
    assert.equal(job.attempts, 1)
    assert.ok(job.nextAttemptAt > Date.now() + 50_000)
  })

  it('gives up when the next attempt would come after the job expires', async () => {
    const store = await storeWithJobs(1, 60_000)
    const {metrics} = startWorker(
      store,
      async () => ({kind: 'retry', reason: 'UNAVAILABLE'}),
      {retryDelayMs: () => 120_000},
    )
    await eventually(() => store.jobs.length === 0)
    assert.equal(await counted(metrics, 'failed'), 1)
  })

  it('removes jobs that cannot succeed', async () => {
    const store = await storeWithJobs(3)
    const outcomes: Outcome[] = [
      {kind: 'invalid_token'},
      {kind: 'failed', reason: 'PayloadTooLarge'},
      {kind: 'expired'},
    ]
    startWorker(store, async () => outcomes.shift()!)
    await eventually(() => store.jobs.length === 0)
  })

  it('treats a crashing send as worth retrying', async () => {
    const store = await storeWithJobs(1)
    let calls = 0
    startWorker(store, async () => {
      calls++
      if (calls === 1) throw new Error('boom')
      return {kind: 'sent'}
    })
    await eventually(() => store.jobs.length === 0)
    assert.equal(calls, 2)
  })

  it('keeps going while the store is briefly unavailable', async () => {
    const store = await storeWithJobs(1)
    store.failing = true
    startWorker(store, async () => ({kind: 'sent'}))
    await new Promise(resolve => setTimeout(resolve, 30))
    store.failing = false
    await eventually(() => store.jobs.length === 0)
  })

  it('picks up new jobs as soon as it is woken', async () => {
    const store = await storeWithJobs(0)
    const delivered: string[] = []
    const metrics = createMetrics({defaultMetrics: false})
    const worker = new Worker({
      store,
      deliverer: {
        deliver: async job => {
          delivered.push(job.notification.id)
          return {kind: 'sent'}
        },
      },
      metrics,
      logger: silentLogger,
      concurrency: 4,
      receiptTtlMs: 86_400_000,
      pollMs: 60_000,
    })
    running = worker
    worker.start()
    await new Promise(resolve => setTimeout(resolve, 10))
    await store.enqueue(
      [
        {
          notification: bridgeNotification({id: 'late'}),
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
      100,
    )
    worker.wake()
    await eventually(() => delivered.length === 1, 1_000)
  })

  it('waits for sends in flight when stopped', async () => {
    const store = await storeWithJobs(1)
    let finished = false
    const {worker} = startWorker(store, async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      finished = true
      return {kind: 'sent'}
    })
    await eventually(() => store.jobs[0]?.attempts === 1)
    running = undefined
    await worker.stop(1_000)
    assert.equal(finished, true)
  })
})

describe('defaultRetryDelayMs', () => {
  it('backs off from 5 seconds to at most 30 minutes', () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 20].map(defaultRetryDelayMs),
      [5_000, 20_000, 80_000, 320_000, 1_280_000, 1_800_000, 1_800_000],
    )
  })
})
