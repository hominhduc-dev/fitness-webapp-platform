import { Router } from "express"
import { z } from "zod"
import { asyncHandler, validated } from "../middleware/validate"
import { aiLimiter } from "../middleware/rate-limit"
import { requireCurrentProfile } from "../services/auth.service"
import { AppError } from "../services/errors"
import { ensureContextPrisma } from "../services/ai/context/helpers"
import { createRun, createRunSchema, cancelRun, getOwnedRun, listConversations, readConversation, listMemories, saveMemory, memorySchema, listContextOptions } from "../agent/service"
import { decideApproval } from "../agent/approval"
import { abortAgentRun, isTerminal } from "../agent/worker"
import { getAccessToken, sendData } from "./route.utils"

const agentRouter = Router()
const idParams = z.object({ id: z.uuid() })
agentRouter.use(asyncHandler(async (req, _res, next) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  _res.locals.agentActorId = profile.id
  next()
}))
agentRouter.get("/conversations", asyncHandler(async (_req, res) => { sendData(res, await listConversations(res.locals.agentActorId)) }))
agentRouter.get("/conversations/:id", validated({ params: idParams }, async (req, res) => { sendData(res, await readConversation(res.locals.agentActorId, req.params.id)) }))
agentRouter.get("/context-options", validated({ query: z.object({ subjectId: z.uuid().optional() }) }, async (req, res) => {
  sendData(res, await listContextOptions(res.locals.agentActorId, req.query.subjectId as string | undefined))
}))
agentRouter.get("/memories", asyncHandler(async (_req, res) => { sendData(res, await listMemories(res.locals.agentActorId)) }))
agentRouter.put("/memories", validated({ body: memorySchema }, async (req, res) => { sendData(res, await saveMemory(res.locals.agentActorId, req.body)) }))
agentRouter.delete("/memories/:id", validated({ params: idParams }, async (req, res) => {
  await listMemories(res.locals.agentActorId)
  await ensureContextPrisma().agentMemory.deleteMany({ where: { id: req.params.id, actorId: res.locals.agentActorId } })
  sendData(res, { deleted: true })
}))
agentRouter.post("/runs", aiLimiter, validated({ body: createRunSchema }, async (req, res) => {
  if (process.env.AGENT_WORKER_ENABLED !== "true" && process.env.AGENT_ENABLED !== "true") throw new AppError("Agent worker chưa được bật.", { code: "AGENT_DISABLED", status: 503 })
  sendData(res, await createRun(res.locals.agentActorId, req.body), { status: 202 })
}))
agentRouter.get("/runs/:id", validated({ params: idParams }, async (req, res) => {
  const run = await getOwnedRun(res.locals.agentActorId, req.params.id)
  const { checkpoint: _checkpoint, leaseToken: _token, requestKey: _key, ...visible } = run
  sendData(res, visible)
}))
agentRouter.post("/runs/:id/cancel", validated({ params: idParams }, async (req, res) => {
  sendData(res, await cancelRun(res.locals.agentActorId, req.params.id)); abortAgentRun(req.params.id)
}))
agentRouter.post("/approvals/:id/decide", validated({ params: idParams, body: z.object({ payloadHash: z.string().regex(/^[a-f0-9]{64}$/), approve: z.boolean() }).strict() }, async (req, res) => {
  sendData(res, await decideApproval(res.locals.agentActorId, req.params.id, req.body.payloadHash, req.body.approve))
}))
agentRouter.get("/runs/:id/events", validated({ params: idParams, query: z.object({ after: z.coerce.number().int().min(0).default(0) }) }, async (req, res) => {
  const actorId = res.locals.agentActorId as string
  await getOwnedRun(actorId, req.params.id)
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders()
  let after = req.query.after
  let inFlight = false
  const poll = async () => {
    if (inFlight || res.destroyed) return
    inFlight = true
    try {
      const run = await getOwnedRun(actorId, req.params.id)
      const events = await ensureContextPrisma().agentEvent.findMany({ where: { runId: run.id, id: { gt: after } }, orderBy: { id: "asc" }, take: 100 })
      for (const event of events) {
        // Tool data is available through the final answer; SSE sends progress metadata only.
        const payload = event.payload as Record<string, unknown>
        const data = { id: event.id, type: event.type, tool: payload.name, status: run.status }
        res.write(`id: ${event.id}\ndata: ${JSON.stringify({ data, error: null, meta: null })}\n\n`)
        after = event.id
      }
      if (!events.length) res.write(": heartbeat\n\n")
      res.flush()
      if ((isTerminal(run.status) || run.status === "waiting_approval") && events.length < 100) { clearInterval(interval); res.end() }
    } catch { clearInterval(interval); res.end() }
    finally { inFlight = false }
  }
  const interval = setInterval(() => { void poll() }, 2000)
  const lifetime = setTimeout(() => { clearInterval(interval); res.end() }, 120_000)
  res.on("close", () => { clearInterval(interval); clearTimeout(lifetime) })
  await poll()
}))
export { agentRouter }
