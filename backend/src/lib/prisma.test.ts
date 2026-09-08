import { Prisma } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"

import { retryTransaction } from "./prisma"

/**
 * Connectivity failures reach us as several different Prisma error classes, and
 * only PrismaClientKnownRequestError puts the code on `.code`. A P1001 raised
 * while the engine cannot open a socket arrives as PrismaClientInitializationError
 * (code on `.errorCode`, frequently undefined), so a retry predicate that only
 * reads `.code` silently never retries the very failures it lists.
 */
describe("retryTransaction", () => {
  it("returns the result without retrying when the call succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok")

    await expect(retryTransaction(fn)).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries a P1001 raised as PrismaClientInitializationError", async () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `aws-1-ap-southeast-1.pooler.supabase.com:6543`",
      "6.19.0",
      "P1001",
    )
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("recovered")

    await expect(retryTransaction(fn)).resolves.toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries an unreachable-server error that carries no error code at all", async () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `aws-1-ap-southeast-1.pooler.supabase.com:6543`",
      "6.19.0",
    )
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("recovered")

    await expect(retryTransaction(fn)).resolves.toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries a stale-socket reset", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ConnectionReset: connection forcibly closed"))
      .mockResolvedValue("recovered")

    await expect(retryTransaction(fn)).resolves.toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("does not retry a unique-constraint violation", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      clientVersion: "6.19.0",
      code: "P2002",
    })
    const fn = vi.fn().mockRejectedValue(error)

    await expect(retryTransaction(fn)).rejects.toBe(error)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("gives up and rethrows once the attempt budget is spent", async () => {
    const error = new Prisma.PrismaClientInitializationError("Can't reach database server", "6.19.0", "P1001")
    const fn = vi.fn().mockRejectedValue(error)

    await expect(retryTransaction(fn, 3)).rejects.toBe(error)
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
