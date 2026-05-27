import { Router } from "express"

import { env } from "../config/env"
import { prisma } from "../lib/prisma"
import { supabaseStatus } from "../lib/supabase"

const healthRouter = Router()

async function getDatabaseHealth() {
  const hasDirectUrl = Boolean(env.directUrl && !env.directUrl.includes("[YOUR_"))

  if (!env.databaseUrl || !prisma) {
    return {
      configured: false,
      connected: false,
      hasDirectUrl,
      message: "DATABASE_URL is not configured",
      migrationReady: false,
    }
  }

  try {
    await prisma.$queryRaw`SELECT 1`

    return {
      configured: true,
      connected: true,
      hasDirectUrl,
      message: "Database reachable through Prisma",
      migrationReady: hasDirectUrl,
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      hasDirectUrl,
      message: error instanceof Error ? error.message : "Unknown database error",
      migrationReady: hasDirectUrl,
    }
  }
}

function getSupabaseHealth() {
  return supabaseStatus
}

healthRouter.get("/", async (_req, res) => {
  const database = await getDatabaseHealth()
  const supabase = getSupabaseHealth()

  res.json({
    database,
    service: "fitness-app-backend",
    status: database.connected && database.configured ? "ok" : "degraded",
    supabase,
    timestamp: new Date().toISOString(),
  })
})

healthRouter.get("/database", async (_req, res) => {
  const database = await getDatabaseHealth()

  res.status(database.connected && database.configured ? 200 : 503).json(database)
})

healthRouter.get("/supabase", (_req, res) => {
  res.json(getSupabaseHealth())
})

export { healthRouter }
