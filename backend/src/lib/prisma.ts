import { Prisma, PrismaClient } from "@prisma/client"

import { env } from "../config/env"

const globalForPrisma = globalThis as {
  prisma?: PrismaClient
}

function getPrismaDatasourceUrl() {
  if (!env.databaseUrl) {
    return undefined
  }

  try {
    const url = new URL(env.databaseUrl)

    // Supabase PgBouncer (transaction mode) — enforce a sensible connection pool.
    // connection_limit=1 is the default when using PgBouncer but causes P2024 timeouts
    // under concurrent load (e.g. admin page fires 6+ queries in Promise.all).
    // We force it to 10 regardless of what the URL already has, and bump pool_timeout
    // to 30 s so queued requests don't fail while waiting for a free slot.
    if (/pooler\.supabase\.com$/i.test(url.hostname)) {
      url.searchParams.set("connection_limit", "10")
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "30")
      }
      // TCP keepalive: send a probe every 10 s so PgBouncer never sees the
      // client connection as idle and closes it (which causes ConnectionReset /
      // OS error 10054 on Windows).
      if (!url.searchParams.has("keepalives")) {
        url.searchParams.set("keepalives", "1")
      }
      if (!url.searchParams.has("keepalives_idle")) {
        url.searchParams.set("keepalives_idle", "10")
      }
      if (!url.searchParams.has("keepalives_interval")) {
        url.searchParams.set("keepalives_interval", "5")
      }
      if (!url.searchParams.has("keepalives_count")) {
        url.searchParams.set("keepalives_count", "5")
      }
      // Fail fast on a stale socket so Prisma can open a fresh connection.
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "10")
      }
    }

    return url.toString()
  } catch {
    return env.databaseUrl
  }
}

// Slow-query instrumentation is opt-in via PRISMA_SLOW_QUERY_MS. When enabled we
// switch the "query" log channel to event emission so we can time each statement
// and only surface the slow ones (see the $on("query") handler below).
const slowQueryMs = env.prismaSlowQueryMs

function createPrismaClient() {
  const datasourceUrl = getPrismaDatasourceUrl()

  const baseLog: Prisma.LogDefinition[] | Prisma.LogLevel[] =
    env.nodeEnv === "development" ? ["error", "warn"] : ["error"]

  return new PrismaClient({
    datasources: datasourceUrl
      ? {
          db: {
            url: datasourceUrl,
          },
        }
      : undefined,
    log: slowQueryMs > 0
      ? [{ emit: "event", level: "query" }, ...baseLog.map((level) => level as Prisma.LogLevel)]
      : baseLog,
  })
}

const prisma = env.databaseUrl ? (globalForPrisma.prisma ?? createPrismaClient()) : null

if (env.nodeEnv !== "production" && prisma) {
  globalForPrisma.prisma = prisma
}

// Suppress the noisy but harmless "connection forcibly closed" log that
// Prisma emits when PgBouncer recycles an idle server connection.
// Prisma recovers automatically — these are not real failures.
if (prisma) {
  prisma.$on("error" as never, (e: { message?: string }) => {
    const msg = e?.message ?? ""
    if (
      msg.includes("ConnectionReset") ||
      msg.includes("connection forcibly closed") ||
      msg.includes("Error in PostgreSQL connection")
    ) {
      return // swallow — Prisma will reconnect transparently
    }
    console.error("[prisma]", msg)
  })
}

// Slow-query log: prints the DB execution time and SQL for any statement that
// meets the PRISMA_SLOW_QUERY_MS threshold. `duration` is pure server-side
// execution time and does NOT include time spent waiting for a free pool
// connection — watch for P2024 / pool_timeout separately to spot pool contention.
if (prisma && slowQueryMs > 0) {
  prisma.$on("query" as never, (event: { duration: number; query: string; params: string }) => {
    if (event.duration >= slowQueryMs) {
      const sql = event.query.replace(/\s+/g, " ").trim().slice(0, 300)
      console.warn(`[prisma:slow] ${event.duration}ms ${sql}`)
    }
  })
}

// Codes that are safe to retry automatically:
//   P2028 — transaction API error (timeout)
//   P1001 — can't reach database server
//   P1008 — operations timed out
//   P1017 — server has closed the connection (stale PgBouncer conn)
const RETRYABLE_CODES = new Set(["P2028", "P1001", "P1008", "P1017"])

// Detect a raw I/O connection-reset even when Prisma wraps it without a code
function isConnectionReset(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("ConnectionReset") ||
    msg.includes("connection forcibly closed") ||
    msg.includes("P1017")
  )
}

async function retryTransaction<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null
      const shouldRetry =
        (code && RETRYABLE_CODES.has(code)) || isConnectionReset(error)
      if (shouldRetry && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

export { prisma, retryTransaction }
