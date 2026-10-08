import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rows: vi.fn(), create: vi.fn() }))
vi.mock("../lib/prisma", () => ({ prisma: { agentMemory: { findMany: mocks.rows } } }))
vi.mock("./service", () => ({ createRun: mocks.create }))
import { enqueueWeeklyReviews } from "./weekly-review"
const row = { id: "m", actorId: "c", actor: { notificationPreference: { coachWeeklyReviewEnabled: true, coachWeeklyReviewDay: 0, coachWeeklyReviewTime: "18:00", timeZone: "Asia/Ho_Chi_Minh" } } }
beforeEach(() => { vi.resetAllMocks(); mocks.rows.mockResolvedValue([row]) })
describe("opt-in weekly coach review scheduling", () => {
  it("queues only opted-in approved coaches at their configured local time", async () => {
    await enqueueWeeklyReviews(new Date("2026-10-11T11:05:00Z"))
    expect(mocks.rows.mock.calls[0][0].where).toMatchObject({ key: "weekly_review_enabled", content: "true", actor: { coachApprovalStatus: "approved" } })
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.create.mock.calls[0][1].message).toContain("Không tự ghi chú")
  })
  it("reuses the same idempotency key for repeated ticks within the week", async () => {
    await enqueueWeeklyReviews(new Date("2026-10-11T11:05:00Z"))
    await enqueueWeeklyReviews(new Date("2026-10-11T11:06:00Z"))
    expect(mocks.create.mock.calls[0][1].requestKey).toBe(mocks.create.mock.calls[1][1].requestKey)
  })
  it("does not queue on the wrong day or outside the catch-up window", async () => {
    await enqueueWeeklyReviews(new Date("2026-10-10T11:05:00Z"))
    await enqueueWeeklyReviews(new Date("2026-10-11T09:00:00Z"))
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("respects the coach's disabled notification review schedule", async () => {
    mocks.rows.mockResolvedValue([{ ...row, actor: { notificationPreference: { ...row.actor.notificationPreference, coachWeeklyReviewEnabled: false } } }])
    await enqueueWeeklyReviews(new Date("2026-10-11T11:05:00Z"))
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
