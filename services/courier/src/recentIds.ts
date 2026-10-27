/**
 * Notification ids accepted recently. The AppView retries a batch it timed
 * out on with the same ids, and this keeps the retry from pushing twice.
 */
export class RecentIds {
  private expiries = new Map<string, number>()
  private maxSize: number
  private ttlMs: number

  constructor({maxSize, ttlMs}: {maxSize: number; ttlMs: number}) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  has(id: string, now = Date.now()): boolean {
    const expiresAt = this.expiries.get(id)
    if (expiresAt === undefined) return false
    if (expiresAt <= now) {
      this.expiries.delete(id)
      return false
    }
    return true
  }

  add(id: string, now = Date.now()): void {
    // Re-inserting moves the id to the end, so eviction stays oldest-first.
    this.expiries.delete(id)
    this.expiries.set(id, now + this.ttlMs)
    for (const oldest of this.expiries.keys()) {
      if (this.expiries.size <= this.maxSize) break
      this.expiries.delete(oldest)
    }
  }
}
