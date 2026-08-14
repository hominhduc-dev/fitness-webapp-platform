import { afterEach, describe, expect, it, vi } from "vitest"

import { TtlCache } from "./cache"

afterEach(() => {
  vi.useRealTimers()
})

describe("TtlCache", () => {
  it("returns a stored value before it expires", () => {
    const cache = new TtlCache()
    cache.set("exercises", ["squat"], 1000)

    expect(cache.get<string[]>("exercises")).toEqual(["squat"])
  })

  it("returns undefined for an unknown key", () => {
    expect(new TtlCache().get("missing")).toBeUndefined()
  })

  it("drops a value once its TTL has passed", () => {
    vi.useFakeTimers()
    const cache = new TtlCache()
    cache.set("exercises", ["squat"], 1000)

    vi.advanceTimersByTime(999)
    expect(cache.get("exercises")).toEqual(["squat"])

    vi.advanceTimersByTime(1)
    expect(cache.get("exercises")).toBeUndefined()
  })

  it("forgets a deleted key", () => {
    const cache = new TtlCache()
    cache.set("a", 1, 1000)
    cache.delete("a")

    expect(cache.get("a")).toBeUndefined()
  })

  it("clears every key", () => {
    const cache = new TtlCache()
    cache.set("a", 1, 1000)
    cache.set("b", 2, 1000)
    cache.clear()

    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("b")).toBeUndefined()
  })
})

describe("TtlCache.getOrLoad", () => {
  it("runs the loader once and caches the result", async () => {
    const cache = new TtlCache()
    const loader = vi.fn(async () => "value")

    expect(await cache.getOrLoad("k", 1000, loader)).toBe("value")
    expect(await cache.getOrLoad("k", 1000, loader)).toBe("value")
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("collapses concurrent misses into a single loader call", async () => {
    // This is the property that protects the PgBouncer pool: without single-flight,
    // N simultaneous cold reads would each open a connection.
    const cache = new TtlCache()
    let resolveLoader: (value: string) => void = () => {}
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve
        }),
    )

    const inflight = [cache.getOrLoad("k", 1000, loader), cache.getOrLoad("k", 1000, loader), cache.getOrLoad("k", 1000, loader)]
    resolveLoader("shared")

    expect(await Promise.all(inflight)).toEqual(["shared", "shared", "shared"])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("does not cache a failed load, so the next call retries", async () => {
    const cache = new TtlCache()
    const loader = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("recovered")

    await expect(cache.getOrLoad("k", 1000, loader)).rejects.toThrow("db down")
    await expect(cache.getOrLoad("k", 1000, loader)).resolves.toBe("recovered")
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("reloads after the entry expires", async () => {
    vi.useFakeTimers()
    const cache = new TtlCache()
    const loader = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second")

    expect(await cache.getOrLoad("k", 1000, loader)).toBe("first")
    vi.advanceTimersByTime(1001)
    expect(await cache.getOrLoad("k", 1000, loader)).toBe("second")
  })
})
