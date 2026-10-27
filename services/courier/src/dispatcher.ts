/**
 * A bounded work queue. Callers learn up front when it is full, so the
 * AppView can keep a batch in its own retry queue instead of the courier
 * growing without limit while Apple or Google are slow.
 */
export class Dispatcher<T> {
  private queue: T[] = []
  private head = 0
  private active = 0
  private idleWaiters: (() => void)[] = []
  private concurrency: number
  private maxQueued: number
  private work: (item: T) => Promise<void>
  private onError: (err: unknown) => void

  constructor({
    concurrency,
    maxQueued,
    work,
    onError,
  }: {
    concurrency: number
    maxQueued: number
    work: (item: T) => Promise<void>
    onError: (err: unknown) => void
  }) {
    this.concurrency = concurrency
    this.maxQueued = maxQueued
    this.work = work
    this.onError = onError
  }

  /**
   * Items waiting or running.
   */
  get size(): number {
    return this.queue.length - this.head + this.active
  }

  /**
   * Queues all items, or none of them when that would exceed the limit.
   */
  tryEnqueue(items: T[]): boolean {
    if (this.size + items.length > this.maxQueued) return false
    this.queue.push(...items)
    this.pump()
    return true
  }

  /**
   * Resolves once the queue is empty, or after `timeoutMs`.
   */
  async drain(timeoutMs: number): Promise<void> {
    if (this.size === 0) return
    let timer: NodeJS.Timeout | undefined
    await Promise.race([
      new Promise<void>(resolve => this.idleWaiters.push(resolve)),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, timeoutMs)
      }),
    ])
    clearTimeout(timer)
  }

  private pump(): void {
    while (this.active < this.concurrency && this.head < this.queue.length) {
      const item = this.queue[this.head] as T
      this.head++
      this.active++
      this.work(item)
        .catch(this.onError)
        .finally(() => {
          this.active--
          this.pump()
        })
    }
    if (this.head === this.queue.length) {
      this.queue = []
      this.head = 0
    } else if (this.head > 1024 && this.head * 2 > this.queue.length) {
      this.queue = this.queue.slice(this.head)
      this.head = 0
    }
    if (this.size === 0) {
      for (const resolve of this.idleWaiters.splice(0)) resolve()
    }
  }
}
