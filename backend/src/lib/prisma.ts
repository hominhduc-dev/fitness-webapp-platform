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
    }

    return url.toString()
  } catch {
    return env.databaseUrl
  }
}

function createPrismaClient() {
  const datasourceUrl = getPrismaDatasourceUrl()

  return new PrismaClient({
    datasources: datasourceUrl
      ? {
          db: {
            url: datasourceUrl,
          },
        }
      : undefined,
    log: env.nodeEnv === "development" ? ["error", "warn"] : ["error"],
  })
}

const prisma = env.databaseUrl ? (globalForPrisma.prisma ?? createPrismaClient()) : null

if (env.nodeEnv !== "production" && prisma) {
  globalForPrisma.prisma = prisma
}

const RETRYABLE_CODES = new Set(["P2028", "P1001", "P1008", "P1017"])

async function retryTransaction<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null
      if (code && RETRYABLE_CODES.has(code) && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

export { prisma, retryTransaction }
