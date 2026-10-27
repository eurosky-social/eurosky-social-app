import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {Dispatcher} from './dispatcher.ts'
import {RecentIds} from './recentIds.ts'

function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>(r => {
    resolve = r
  })
  return {promise, resolve}
}

describe('Dispatcher', () => {
  it('runs at most `concurrency` items at once', async () => {
    const gate = deferred()
    let running = 0
    let peak = 0
    const dispatcher = new Dispatcher<number>({
      concurrency: 2,
      maxQueued: 10,
      work: async () => {
        running++
        peak = Math.max(peak, running)
        await gate.promise
        running--
      },
      onError: () => {},
    })
    assert.equal(dispatcher.tryEnqueue([1, 2, 3, 4, 5]), true)
    assert.equal(dispatcher.size, 5)
    assert.equal(running, 2)
    gate.resolve()
    await dispatcher.drain(1_000)
    assert.equal(peak, 2)
    assert.equal(dispatcher.size, 0)
  })

  it('takes all items of a batch or none', async () => {
    const gate = deferred()
    const dispatcher = new Dispatcher<number>({
      concurrency: 1,
      maxQueued: 3,
      work: () => gate.promise,
      onError: () => {},
    })
    assert.equal(dispatcher.tryEnqueue([1, 2]), true)
    assert.equal(dispatcher.tryEnqueue([3, 4]), false)
    assert.equal(dispatcher.size, 2)
    assert.equal(dispatcher.tryEnqueue([3]), true)
    gate.resolve()
    await dispatcher.drain(1_000)
  })

  it('reports a crashed item and keeps going', async () => {
    const errors: unknown[] = []
    const done: number[] = []
    const dispatcher = new Dispatcher<number>({
      concurrency: 1,
      maxQueued: 10,
      work: async n => {
        if (n === 1) throw new Error('boom')
        done.push(n)
      },
      onError: err => errors.push(err),
    })
    dispatcher.tryEnqueue([1, 2])
    await dispatcher.drain(1_000)
    assert.equal(errors.length, 1)
    assert.deepEqual(done, [2])
  })

  it('stops waiting for a drain after the timeout', async () => {
    const dispatcher = new Dispatcher<number>({
      concurrency: 1,
      maxQueued: 10,
      work: () => new Promise(() => {}),
      onError: () => {},
    })
    dispatcher.tryEnqueue([1])
    const started = Date.now()
    await dispatcher.drain(30)
    assert.ok(Date.now() - started < 1_000)
    assert.equal(dispatcher.size, 1)
  })
})

describe('RecentIds', () => {
  it('remembers ids until they expire', () => {
    const ids = new RecentIds({maxSize: 10, ttlMs: 1_000})
    ids.add('a', 0)
    assert.equal(ids.has('a', 999), true)
    assert.equal(ids.has('a', 1_000), false)
    assert.equal(ids.has('b', 0), false)
  })

  it('forgets the oldest ids beyond the size limit', () => {
    const ids = new RecentIds({maxSize: 2, ttlMs: 1_000})
    ids.add('a', 0)
    ids.add('b', 0)
    ids.add('a', 1)
    ids.add('c', 2)
    assert.equal(ids.has('b', 3), false)
    assert.equal(ids.has('a', 3), true)
    assert.equal(ids.has('c', 3), true)
  })
})
