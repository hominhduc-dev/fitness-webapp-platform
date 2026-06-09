/**
 * Tiny in-process TTL cache.
 *
 * Intended for read-heavy reference data (exercise / food libraries) where the
 * cost is many cross-region DB round-trips, not data volume. Scope is a single
 * Node process — if the backend is ever scaled to multiple instances, replace
 * this with a shared store (e.g. Redis) so invalidation stays consistent.
 *
 * `getOrLoad` is single-flight: concurrent misses for the same key share one
 * loader call instead of each opening its own DB connection. This also relieves
 * the Supabase PgBouncer pool under bursty load.
 */
type CacheEntry<T> = {
  expiresAt: number
  value: T
}

export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>()
  private readonly inflight = new Map<string, Promise<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      return undefined
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { expiresAt: Date.now() + ttlMs, value })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  async getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }

    const existing = this.inflight.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs)
        return value
      })
      .finally(() => {
        this.inflight.delete(key)
      })

    this.inflight.set(key, promise)
    return promise
  }
}
