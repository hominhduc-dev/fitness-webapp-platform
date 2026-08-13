/**
 * Per-user daily counters held in memory.
 *
 * Used for limits that are not worth a database row (chat messages, and how
 * many program drafts a conversation may trigger). Being in-memory means the
 * count is per backend instance and resets on restart — acceptable for abuse
 * damping, not for anything that must be exact.
 *
 * Entries are evicted once they are no longer for the current day, so the map
 * cannot grow without bound as users come and go.
 */

type Entry = { date: string; count: number }

class DailyCounter {
  private readonly entries = new Map<string, Entry>()
  private lastSweep = ""

  constructor(private readonly limit: number) {}

  private today() {
    return new Date().toISOString().slice(0, 10)
  }

  /** Drops entries from previous days; runs at most once per day. */
  private sweep(today: string) {
    if (this.lastSweep === today) {
      return
    }
    for (const [key, entry] of this.entries) {
      if (entry.date !== today) {
        this.entries.delete(key)
      }
    }
    this.lastSweep = today
  }

  /** True when the caller is still under the limit; counts the use. */
  tryConsume(userId: string): boolean {
    const today = this.today()
    this.sweep(today)

    const entry = this.entries.get(userId)

    if (!entry || entry.date !== today) {
      this.entries.set(userId, { date: today, count: 1 })
      return true
    }

    if (entry.count >= this.limit) {
      return false
    }

    entry.count += 1
    return true
  }

  /** Gives back a use, for work that was counted then failed. */
  release(userId: string) {
    const entry = this.entries.get(userId)
    if (entry && entry.date === this.today() && entry.count > 0) {
      entry.count -= 1
    }
  }

  get max() {
    return this.limit
  }

  /** Testing aid. */
  size() {
    return this.entries.size
  }
}

export { DailyCounter }
