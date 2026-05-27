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

    // Supabase pooled connections can run out quickly in local dev if Prisma opens
    // its default connection count. Keep the pool intentionally tiny unless the
    // URL already sets an explicit limit.
    if (/pooler\.supabase\.com$/i.test(url.hostname) && !url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "10")
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
