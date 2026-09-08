import { Prisma } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"

import { buildPooledDatasourceUrl, retryTransaction } from "./prisma"

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

describe("buildPooledDatasourceUrl", () => {
  const pooler = (port: number) =>
    `postgresql://postgres.abcdefghijklm:pw@aws-1-ap-southeast-1.pooler.supabase.com:${port}/postgres`

  it("marks port 6543 as PgBouncer transaction mode", () => {
    // Without pgbouncer=true, Prisma reuses server-side prepared statements across
    // pooled connections and fails with `prepared statement "s0" already exists`.
    const params = new URL(buildPooledDatasourceUrl(pooler(6543))).searchParams

    expect(params.get("pgbouncer")).toBe("true")
  })

  it("leaves port 5432 in session mode, where prepared statements are safe", () => {
    const params = new URL(buildPooledDatasourceUrl(pooler(5432))).searchParams

    expect(params.get("pgbouncer")).toBeNull()
  })

  it("applies the pool sizing to both pooler ports", () => {
    for (const port of [5432, 6543]) {
      const params = new URL(buildPooledDatasourceUrl(pooler(port))).searchParams

      expect(params.get("connection_limit")).toBe("10")
      expect(params.get("pool_timeout")).toBe("30")
      expect(params.get("connect_timeout")).toBe("10")
    }
  })

  it("never appends libpq keepalive params the Prisma connector cannot read", () => {
    const params = new URL(buildPooledDatasourceUrl(pooler(5432))).searchParams

    expect(params.get("keepalives")).toBeNull()
    expect(params.get("keepalives_idle")).toBeNull()
  })

  it("respects an explicit pgbouncer value already in the URL", () => {
    const params = new URL(buildPooledDatasourceUrl(`${pooler(6543)}?pgbouncer=false`)).searchParams

    expect(params.get("pgbouncer")).toBe("false")
  })

  it("leaves a non-pooler direct connection untouched", () => {
    const direct = "postgresql://postgres:pw@db.abcdefghijklm.supabase.co:5432/postgres"

    expect(buildPooledDatasourceUrl(direct)).toBe(direct)
  })

  it("returns an unparseable string unchanged instead of throwing", () => {
    expect(buildPooledDatasourceUrl("not a url")).toBe("not a url")
  })
})
