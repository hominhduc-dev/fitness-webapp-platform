import type { Request } from "express"
import { describe, expect, it } from "vitest"

import { callerKey } from "./rate-limit"

function fakeRequest(options: { authorization?: string; ip?: string }) {
  return {
    headers: options.authorization ? { authorization: options.authorization } : {},
    ip: options.ip ?? "203.0.113.5",
  } as unknown as Request
}

describe("callerKey", () => {
  it("buckets by the bearer token so one user cannot exhaust another's budget", () => {
    const shared = "203.0.113.5"
    const alice = callerKey(fakeRequest({ authorization: "Bearer alice-token", ip: shared }))
    const bob = callerKey(fakeRequest({ authorization: "Bearer bob-token", ip: shared }))

    expect(alice).not.toBe(bob)
  })

  it("is stable for the same token", () => {
    const first = callerKey(fakeRequest({ authorization: "Bearer alice-token" }))
    const second = callerKey(fakeRequest({ authorization: "Bearer alice-token" }))

    expect(first).toBe(second)
  })

  it("never puts the raw token in the key", () => {
    // The key ends up in an in-memory store and in error paths; a raw access token
    // there would be a credential leak.
    const key = callerKey(fakeRequest({ authorization: "Bearer super-secret-access-token" }))

    expect(key).not.toContain("super-secret-access-token")
    expect(key.startsWith("t:")).toBe(true)
  })

  it("falls back to the IP bucket for anonymous callers", () => {
    expect(callerKey(fakeRequest({ ip: "203.0.113.5" })).startsWith("ip:")).toBe(true)
  })

  it("ignores an Authorization header that is not a bearer token", () => {
    expect(callerKey(fakeRequest({ authorization: "Basic dXNlcjpwYXNz" })).startsWith("ip:")).toBe(true)
  })

  it("falls back to the IP bucket when the bearer value is blank", () => {
    expect(callerKey(fakeRequest({ authorization: "Bearer    " })).startsWith("ip:")).toBe(true)
  })

  it("groups IPv6 callers by subnet rather than by individual address", () => {
    // A single IPv6 host is routinely handed a /64 of addresses, so per-address
    // buckets would make the limit trivially bypassable.
    const first = callerKey(fakeRequest({ ip: "2001:db8:1234:5678::1" }))
    const second = callerKey(fakeRequest({ ip: "2001:db8:1234:5678::2" }))

    expect(first).toBe(second)
  })
})
