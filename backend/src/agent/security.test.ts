import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }))
vi.mock("../services/ai/context/helpers", () => ({ ensureContextPrisma: () => mocks }))
vi.mock("../services/auth/core", () => ({ serializeProfile: (value: unknown) => value }))
import { requireActor, resolveSubject } from "./security"
const trainee = { id: "t", role: "trainee", isActive: true, coachId: "c" }
const coach = { id: "c", role: "coach", isActive: true, coachApprovalStatus: "approved" }
beforeEach(() => vi.resetAllMocks())
describe("live agent authorization", () => {
  it("allows trainee self-read", async () => {
    mocks.user.findUnique.mockResolvedValue(trainee)
    expect((await resolveSubject("t", "t")).subject.id).toBe("t")
  })
  it("rejects cross-user trainee access", async () => {
    mocks.user.findUnique.mockResolvedValueOnce(trainee).mockResolvedValueOnce({ ...trainee, id: "victim" })
    await expect(resolveSubject("t", "victim")).rejects.toMatchObject({ status: 403 })
  })
  it("allows assigned coach then rejects a revoked relationship on the next execution", async () => {
    mocks.user.findUnique.mockResolvedValueOnce(coach).mockResolvedValueOnce(trainee)
    expect((await resolveSubject("c", "t")).actor.role).toBe("coach")
    mocks.user.findUnique.mockResolvedValueOnce(coach).mockResolvedValueOnce({ ...trainee, coachId: "someone-else" })
    await expect(resolveSubject("c", "t")).rejects.toMatchObject({ status: 403 })
  })
  it("does not grant admin implicit access to fitness data", async () => {
    mocks.user.findUnique.mockResolvedValueOnce({ id: "admin", role: "admin", isActive: true }).mockResolvedValueOnce(trainee)
    await expect(resolveSubject("admin", "t")).rejects.toMatchObject({ status: 403 })
  })
  it("blocks inactive actors and unapproved coaches", async () => {
    mocks.user.findUnique.mockResolvedValue({ ...coach, coachApprovalStatus: "pending" })
    await expect(requireActor("c")).rejects.toMatchObject({ status: 403 })
    mocks.user.findUnique.mockResolvedValue({ ...trainee, isActive: false })
    await expect(requireActor("t")).rejects.toMatchObject({ status: 403 })
  })
})
