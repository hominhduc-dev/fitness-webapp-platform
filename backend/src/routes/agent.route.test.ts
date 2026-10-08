import { beforeEach, describe, expect, it, vi } from "vitest"
import express from "express"
import compression from "compression"
import request from "supertest"
const mocks = vi.hoisted(() => ({ profile: vi.fn(), owned: vi.fn(), create: vi.fn(), decide: vi.fn(), events: vi.fn(), abort: vi.fn() }))
vi.mock("../services/auth.service", () => ({ requireCurrentProfile: mocks.profile }))
vi.mock("../agent/service", async importOriginal => ({ ...await importOriginal<typeof import("../agent/service")>(), getOwnedRun: mocks.owned, createRun: mocks.create }))
vi.mock("../agent/approval", () => ({ decideApproval: mocks.decide }))
vi.mock("../agent/worker", () => ({ abortAgentRun: mocks.abort, isTerminal: (status: string) => status === "completed" }))
vi.mock("../services/ai/context/helpers", () => ({ ensureContextPrisma: () => ({ agentEvent: { findMany: mocks.events } }) }))
vi.mock("../middleware/rate-limit", () => ({ aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }))
import { agentRouter } from "./agent.route"
import { errorHandler } from "../middleware/error-handler"
const app = express(); app.use(express.json()); app.use(compression()); app.use("/api/agent", agentRouter); app.use(errorHandler)
const id = "00000000-0000-4000-8000-000000000001"
beforeEach(() => { vi.clearAllMocks(); mocks.profile.mockResolvedValue({ profile: { id: "authenticated" } }); vi.stubEnv("AGENT_WORKER_ENABLED", "true") })
describe("authenticated agent API", () => {
  it("requires a bearer token before reading runs", async () => {
    const response = await request(app).get(`/api/agent/runs/${id}`)
    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ data: null, error: { code: "MISSING_ACCESS_TOKEN" } })
    expect(mocks.owned).not.toHaveBeenCalled()
  })
  it("takes identity from authentication and does not expose checkpoint or lease", async () => {
    mocks.owned.mockResolvedValue({ id, status: "completed", reply: "Done", checkpoint: { secret: "internal" }, leaseToken: "lease", requestKey: "request", approvals: [] })
    const response = await request(app).get(`/api/agent/runs/${id}`).set("Authorization", "Bearer test")
    expect(mocks.owned).toHaveBeenCalledWith("authenticated", id)
    expect(response.body).toMatchObject({ data: { reply: "Done" }, error: null, meta: null })
    expect(response.body.data).not.toHaveProperty("checkpoint")
    expect(response.body.data).not.toHaveProperty("leaseToken")
  })
  it("rejects model/client supplied actor IDs", async () => {
    const response = await request(app).post("/api/agent/runs").set("Authorization", "Bearer test").send({ message: "Analyze", requestKey: id, actorId: "victim" })
    expect(response.status).toBe(422)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("returns an accepted run with the existing API envelope", async () => {
    mocks.create.mockResolvedValue({ id, status: "queued" })
    const response = await request(app).post("/api/agent/runs").set("Authorization", "Bearer test").send({ message: "Analyze", requestKey: id })
    expect(response.status).toBe(202)
    expect(response.body).toMatchObject({ data: { id, status: "queued" }, error: null, meta: null })
  })
  it("validates the exact approval hash before dispatch", async () => {
    const response = await request(app).post(`/api/agent/approvals/${id}/decide`).set("Authorization", "Bearer test").send({ payloadHash: "wrong", approve: true })
    expect(response.status).toBe(422)
    expect(mocks.decide).not.toHaveBeenCalled()
  })
  it("streams progress events without leaking raw tool data", async () => {
    mocks.owned.mockResolvedValue({ id, status: "completed" })
    mocks.events.mockResolvedValue([{ id: 1, type: "tool.completed", payload: { name: "get_readiness", result: { privateNote: "private" } } }])
    const response = await request(app).get(`/api/agent/runs/${id}/events?after=0`).set("Authorization", "Bearer test")
    expect(response.headers["content-type"]).toContain("text/event-stream")
    expect(response.text).toContain("get_readiness")
    expect(response.text).not.toContain("private")
  })
})
