import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ actor: vi.fn(), subject: vi.fn(), run: vi.fn(), conversation: vi.fn(), runs: vi.fn() }))
vi.mock("./security", () => ({ requireActor: mocks.actor, resolveSubject: mocks.subject }))
vi.mock("../services/ai/context/helpers", () => ({ ensureContextPrisma: () => ({ agentRun: { findFirst: mocks.run, findMany: mocks.runs }, agentConversation: { findFirst: mocks.conversation } }) }))
import { getOwnedRun, readConversation } from "./service"
beforeEach(() => { vi.resetAllMocks(); mocks.actor.mockResolvedValue({ id: "coach", role: "coach" }); mocks.subject.mockResolvedValue({}) })
describe("stored report authorization after coach reassignment", () => {
  it("blocks old run payloads if a tracked trainee is no longer assigned", async () => {
    mocks.run.mockResolvedValue({ id: "run", subjectIds: ["trainee"], approvals: [] })
    mocks.subject.mockRejectedValue(Object.assign(new Error("Revoked"), { status: 403 }))
    await expect(getOwnedRun("coach", "run")).rejects.toMatchObject({ status: 403 })
    expect(mocks.subject).toHaveBeenCalledWith("coach", "trainee")
  })
  it("rechecks all unique subjects before returning stored conversation messages", async () => {
    mocks.conversation.mockResolvedValue({ id: "conversation", messages: [], runs: [] })
    mocks.runs.mockResolvedValue([{ subjectIds: ["one", "two"] }, { subjectIds: ["one"] }])
    await readConversation("coach", "conversation")
    expect(mocks.subject).toHaveBeenCalledTimes(2)
  })
  it("returns 404 for a run not owned by the actor", async () => {
    mocks.run.mockResolvedValue(null)
    await expect(getOwnedRun("coach", "other")).rejects.toMatchObject({ status: 404 })
    expect(mocks.subject).not.toHaveBeenCalled()
  })
})
