import { Prisma, PrismaClient } from "@prisma/client"

import { env } from "../config/env"
import { logger } from "./logger"

const globalForPrisma = globalThis as {
  prisma?: PrismaClient
}

/**
 * Applies the Supabase-pooler tuning to a connection string. Kept pure and
 * exported so the port-dependent behaviour is testable without a live database.
 */
function buildPooledDatasourceUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)

    // Supabase exposes the shared pooler on two ports, and they need different
    // Prisma settings:
    //   6543 — transaction mode (PgBouncer). A pooled connection is handed to a
    //          different session between statements, so Prisma must be told not
    //          to rely on server-side prepared statements. Without pgbouncer=true
    //          this surfaces as `prepared statement "s0" already exists`.
    //   5432 — session mode. One client connection owns one Postgres session for
    //          its lifetime, so prepared statements are safe and pgbouncer=true
    //          would disable them for no benefit.
    // connection_limit=1 is Prisma's default behind PgBouncer but causes P2024
    // timeouts under concurrent load (e.g. the admin page fires 6+ queries in a
    // Promise.all). We force it to 10 regardless of what the URL already has, and
    // bump pool_timeout to 30 s so queued requests don't fail waiting for a slot.
    if (/pooler\.supabase\.com$/i.test(url.hostname)) {
      if (url.port === "6543" && !url.searchParams.has("pgbouncer")) {
        url.searchParams.set("pgbouncer", "true")
      }
      url.searchParams.set("connection_limit", "10")
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "30")
      }
      // NOTE: libpq keepalive settings (keepalives, keepalives_idle, ...) used to
      // be appended here. Prisma's PostgreSQL connector does not read them from
      // the connection string, so they were silently ignored and gave a false
      // sense of protection against idle-connection resets. Stale sockets are
      // handled by retryTransaction() below instead.
      // Fail fast on a stale socket so Prisma can open a fresh connection.
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "10")
      }
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

function getPrismaDatasourceUrl() {
  if (!env.databaseUrl) {
    return undefined
  }

  return buildPooledDatasourceUrl(env.databaseUrl)
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
    logger.error("prisma client error", { detail: msg })
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
      logger.warn("slow query", { durationMs: event.duration, sql })
    }
  })
}

// Codes that are safe to retry automatically:
//   P2028 — transaction API error (timeout)
//   P1001 — can't reach database server
//   P1008 — operations timed out
//   P1017 — server has closed the connection (stale PgBouncer conn)
const RETRYABLE_CODES = new Set(["P2028", "P1001", "P1008", "P1017"])

// Connectivity failures do NOT all arrive as PrismaClientKnownRequestError:
//   - P1001/P1008/P1017 surface as PrismaClientInitializationError, which carries
//     the code on `errorCode` (often undefined) rather than on `code`.
//   - A socket that dies mid-query surfaces as PrismaClientUnknownRequestError
//     with no code at all.
// Reading only `PrismaClientKnownRequestError.code` therefore never matched any
// of the connectivity codes above. Pull the code off whichever field carries it,
// and fall back to matching the engine's message.
function retryableCodeOf(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return error.errorCode ?? null
  }

  return null
}

// Detect a raw I/O failure even when Prisma wraps it without a usable code
function isConnectionFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes("ConnectionReset") ||
    msg.includes("connection forcibly closed") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("P1001") ||
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
      const code = retryableCodeOf(error)
      const shouldRetry =
        (code !== null && RETRYABLE_CODES.has(code)) || isConnectionFailure(error)
      if (shouldRetry && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

export { buildPooledDatasourceUrl, prisma, retryTransaction }
