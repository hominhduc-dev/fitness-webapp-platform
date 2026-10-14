import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ create: vi.fn(), count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), transaction: vi.fn() }))
vi.mock("../lib/prisma", () => ({ prisma: { userFeedback: mocks, $transaction: mocks.transaction } }))
import type { SerializedProfile } from "./auth.service"
import { createFeedback, getFeedback, listFeedback, updateFeedback } from "./feedback.service"
const trainee = { id: "trainee-1", role: "trainee" } as SerializedProfile
const coach = { id: "coach-1", role: "coach" } as SerializedProfile
const admin = { id: "admin-1", role: "admin" } as SerializedProfile
const now = new Date("2026-10-10T12:00:00.000Z")
const record = { id: "feedback-1", category: "bug", message: "Không thể lưu buổi tập", pagePath: "/workout", appVersion: null, status: "new", createdAt: now, updatedAt: now }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.count.mockResolvedValue(0)
  mocks.create.mockResolvedValue(record)
  mocks.findMany.mockResolvedValue([record])
  mocks.findFirst.mockResolvedValue(record)
  mocks.findUnique.mockResolvedValue(record)
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.transaction.mockImplementation((operation: unknown) => typeof operation === "function" ? operation({ userFeedback: mocks }) : Promise.all(operation as Promise<unknown>[]))
})
describe("feedback ownership, privacy and status concurrency", () => {
  it("uses the authenticated reporter, bounds user agent and returns no screenshot on creation", async () => {
    const result = await createFeedback(trainee, { category: "bug", message: record.message }, "x".repeat(600))
    expect(mocks.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ userId: trainee.id, userAgent: "x".repeat(512) }))
    expect(mocks.create.mock.calls[0][0].select).not.toHaveProperty("screenshot")
    expect(result.createdAt).toBe(now.toISOString())
  })
  it("limits submissions per authenticated account", async () => {
    mocks.count.mockResolvedValue(10)
    await expect(createFeedback(trainee, { category: "bug", message: record.message })).rejects.toMatchObject({ status: 429 })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("keeps own listings scoped and paginated without reporter or attachment", async () => {
    await listFeedback(coach, { page: 2, limit: 5 }, true)
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: coach.id }, skip: 5, take: 5 })
    expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty("screenshot")
    expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty("user")
  })
  it("blocks trainee and coach administration before database access", async () => {
    for (const profile of [trainee, coach]) {
      await expect(listFeedback(profile, { page: 1, limit: 20 })).rejects.toMatchObject({ status: 403 })
      await expect(updateFeedback(profile, record.id, { status: "resolved", expectedUpdatedAt: now.toISOString() })).rejects.toMatchObject({ status: 403 })
    }
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it("admin filters expose reporter only, never attachments", async () => {
    await listFeedback(admin, { page: 1, limit: 20, status: "new", category: "bug" })
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: { status: "new", category: "bug" }, select: { user: { select: { email: true, role: true } } } })
    expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty("screenshot")
  })
  it("hides another user's detail as not found, scoped at query time", async () => {
    mocks.findFirst.mockResolvedValue(null)
    await expect(getFeedback(trainee, record.id)).rejects.toMatchObject({ status: 404 })
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: record.id, userId: trainee.id })
  })
  it("allows admin detail attachment with no ownership filter", async () => {
    mocks.findFirst.mockResolvedValue({ ...record, screenshot: "private-image", userAgent: "browser" })
    expect(await getFeedback(admin, record.id)).toMatchObject({ screenshot: "private-image" })
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: record.id })
  })
  it("updates atomically with optimistic timestamp and increments timestamp even in same millisecond", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    try {
      await updateFeedback(admin, record.id, { status: "resolved", expectedUpdatedAt: now.toISOString() })
      expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: record.id, updatedAt: now }, data: { status: "resolved", updatedAt: new Date(now.getTime() + 1) } })
    } finally { vi.useRealTimers() }
  })
  it("returns 409 for stale edits and 404 for removed feedback", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    await expect(updateFeedback(admin, record.id, { status: "resolved", expectedUpdatedAt: now.toISOString() })).rejects.toMatchObject({ status: 409, code: "FEEDBACK_STALE" })
    mocks.findUnique.mockResolvedValue(null)
    await expect(updateFeedback(admin, record.id, { status: "resolved", expectedUpdatedAt: now.toISOString() })).rejects.toMatchObject({ status: 404 })
  })
})
