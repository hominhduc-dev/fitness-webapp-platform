import { startAgentWorker, stopAgentWorker } from "./worker"
import { prisma } from "../lib/prisma"
import { logger } from "../lib/logger"

if (process.env.AGENT_WORKER_ENABLED !== "true") {
  logger.error("Set AGENT_WORKER_ENABLED=true before starting the agent worker")
  process.exitCode = 1
} else {
  startAgentWorker()
  // Scheduler timers are unref'd for API shutdown; a standalone worker needs a keepalive.
  const keepalive = setInterval(() => undefined, 60_000)
  let stopping = false
  const shutdown = async () => {
    if (stopping) return
    stopping = true
    stopAgentWorker()
    clearInterval(keepalive)
    await prisma?.$disconnect()
  }
  process.on("SIGTERM", () => { void shutdown() })
  process.on("SIGINT", () => { void shutdown() })
}
