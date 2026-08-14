import { app } from "./app"
import { env } from "./config/env"
import { logger } from "./lib/logger"
import { prisma } from "./lib/prisma"

const server = app.listen(env.port, () => {
  logger.info("backend started", { environment: env.nodeEnv, port: env.port, url: `http://localhost:${env.port}` })
})

// Allow long-running requests (e.g. bulk exercise import) up to 5 minutes
server.timeout = 300_000
server.keepAliveTimeout = 300_000
server.headersTimeout = 305_000

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error("port already in use", { port: env.port })
    process.exit(1)
  }

  throw error
})

/**
 * Docker sends SIGTERM on `docker compose up -d` redeploys. Without this the
 * container is killed mid-request and in-flight DB connections are left dangling
 * on the PgBouncer pooler.
 */
let shuttingDown = false

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info("shutting down", { signal })

  const forceExit = setTimeout(() => {
    logger.error("graceful shutdown timed out, forcing exit")
    process.exit(1)
  }, 15_000)
  forceExit.unref()

  server.close(async (closeError) => {
    if (closeError) {
      logger.error("failed to close HTTP server", { error: closeError })
    }

    try {
      await prisma?.$disconnect()
    } catch (error) {
      logger.error("failed to disconnect Prisma", { error })
    }

    clearTimeout(forceExit)
    process.exit(closeError ? 1 : 0)
  })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled promise rejection", { error: reason })
})

process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", { error })
  void shutdown("SIGTERM")
})
