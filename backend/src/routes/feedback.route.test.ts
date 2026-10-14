import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ profile: vi.fn(), create: vi.fn(), list: vi.fn(), detail: vi.fn(), update: vi.fn() }))
vi.mock("../services/auth.service", () => ({ requireCurrentProfile: mocks.profile }))
vi.mock("../middleware/rate-limit", () => ({ heavyLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }))
vi.mock("../services/feedback.service", () => ({ createFeedback: mocks.create, listFeedback: mocks.list, getFeedback: mocks.detail, updateFeedback: mocks.update }))
import { feedbackRouter } from "./feedback.route"
import { errorHandler } from "../middleware/error-handler"
import { ConflictError, UnauthorizedError } from "../services/errors"
const app = express()
app.use(express.json())
app.use("/api/feedback", feedbackRouter)
app.use(errorHandler)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile.mockResolvedValue({ profile: { id: "reporter", role: "trainee" } })
  mocks.create.mockResolvedValue({ id: "created" })
  mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
})
describe("feedback HTTP contract", () => {
  it("requires authorization on create and never reaches database without a session", async () => {
    const result = await request(app).post("/api/feedback").send({ category: "bug", message: "Cannot save workout" })
    expect(result.status).toBe(401)
    expect(result.body).toMatchObject({ data: null, error: { code: "MISSING_ACCESS_TOKEN" }, meta: null })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("forwards revoked sessions as 401", async () => {
    mocks.profile.mockRejectedValue(new UnauthorizedError("Session expired"))
    const result = await request(app).get("/api/feedback/mine").set("Authorization", "Bearer test")
    expect(result.status).toBe(401)
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it("creates in the standard envelope with 201", async () => {
    const result = await request(app).post("/api/feedback").set("Authorization", "Bearer test").send({ category: "bug", message: "Cannot save workout" })
    expect(result.status).toBe(201)
    expect(result.body).toEqual({ data: { id: "created" }, error: null, meta: null })
  })
  it("routes mine before uuid detail and parses pagination", async () => {
    const result = await request(app).get("/api/feedback/mine?page=2&limit=5").set("Authorization", "Bearer test")
    expect(result.status).toBe(200)
    expect(mocks.list).toHaveBeenCalledWith({ id: "reporter", role: "trainee" }, { page: 2, limit: 5 }, true)
    expect(mocks.detail).not.toHaveBeenCalled()
  })
  it("rejects sensitive query paths before creation", async () => {
    const result = await request(app).post("/api/feedback").set("Authorization", "Bearer test").send({ category: "bug", message: "Cannot save workout", pagePath: "/chat?token=secret" })
    expect(result.status).toBe(422)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("forwards optimistic conflict error in standard envelope", async () => {
    mocks.update.mockRejectedValue(new ConflictError("Reload", { code: "FEEDBACK_STALE" }))
    const result = await request(app).patch("/api/feedback/1054966f-771f-475e-a5dc-3bc24cb67357").set("Authorization", "Bearer test").send({ status: "resolved", expectedUpdatedAt: "2026-10-10T12:00:00Z" })
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ data: null, error: { code: "FEEDBACK_STALE", message: "Reload" }, meta: null })
  })
})
