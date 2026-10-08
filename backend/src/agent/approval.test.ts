import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  security: vi.fn(),
  tx: { agentApproval: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    program: { findUnique: vi.fn(), updateMany: vi.fn() }, exerciseSet: { updateMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() }, workoutSessionDraft: { count: vi.fn() }, coachNote: { create: vi.fn() },
    agentEvent: { create: vi.fn() }, agentRun: { update: vi.fn(), updateMany: vi.fn() } },
}))
vi.mock("../services/ai/context/helpers", () => ({ ensureContextPrisma: () => ({ $transaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx) }) }))
vi.mock("./security", () => ({ resolveSubject: mocks.security }))
import { decideApproval, fingerprint, changesSchema } from "./approval"
const actorId = "coach"
const program = { id: "program", name: "P", createdById: actorId, archivedAt: null, updatedAt: new Date(), assignments: [{ userId: "trainee" }], workouts: [] }
const payload = { programId: "program", version: fingerprint(program), changes: [{ setId: "set", before: { targetReps: 8, weight: 20, rir: 1 }, after: { targetReps: 8, weight: 22, rir: 1 } }] }
const hash = fingerprint(payload)
const approval = { id: "approval", subjectId: "trainee", runId: "run", kind: "program_changes", status: "pending", payload, payloadHash: hash, expiresAt: new Date(Date.now() + 60_000), run: { status: "waiting_approval", conversation: { actorId } } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.security.mockResolvedValue({ actor: { id: actorId, role: "coach" } })
  mocks.tx.agentApproval.findUnique.mockResolvedValue(approval)
  mocks.tx.program.findUnique.mockResolvedValue(program)
  mocks.tx.program.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.exerciseSet.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.agentApproval.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.agentApproval.count.mockResolvedValue(0)
  mocks.tx.workoutSessionDraft.count.mockResolvedValue(0)
  mocks.tx.agentRun.updateMany.mockResolvedValue({ count: 1 })
})
describe("approval payload and version protection", () => {
  it("keeps hashes stable when JSONB reorders nested object keys", () => {
    expect(fingerprint({ a: 1, b: { x: 2, y: 3 } })).toBe(fingerprint({ b: { y: 3, x: 2 }, a: 1 }))
  })
  it("applies the exact reviewed values and saves the before/after audit", async () => {
    expect(await decideApproval(actorId, "approval", hash, true)).toEqual({ status: "approved" })
    expect(mocks.tx.exerciseSet.updateMany).toHaveBeenCalledWith({ where: { id: "set", completed: false, ...payload.changes[0].before }, data: payload.changes[0].after })
    expect(mocks.tx.agentEvent.create.mock.calls[0][0].data.payload.beforeAfter).toEqual(payload)
    expect(mocks.tx.agentRun.update.mock.calls[0][0].data.status).toBe("queued")
  })
  it("rejects stale program contents before any set write", async () => {
    mocks.tx.program.findUnique.mockResolvedValue({ ...program, name: "Changed after preview" })
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.exerciseSet.updateMany).not.toHaveBeenCalled()
  })
  it("rejects a mismatched or modified payload", async () => {
    await expect(decideApproval(actorId, "approval", "bad-hash", true)).rejects.toMatchObject({ status: 409 })
    mocks.tx.agentApproval.findUnique.mockResolvedValue({ ...approval, payload: { ...payload, changes: [] } })
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 409 })
  })
  it("handles duplicate approval without repeating the write", async () => {
    mocks.tx.agentApproval.findUnique.mockResolvedValue({ ...approval, status: "approved" })
    expect(await decideApproval(actorId, "approval", hash, true)).toEqual({ status: "approved" })
    expect(mocks.tx.exerciseSet.updateMany).not.toHaveBeenCalled()
  })
  it("rejects expired approvals and canceled runs", async () => {
    mocks.tx.agentApproval.findUnique.mockResolvedValue({ ...approval, expiresAt: new Date(0) })
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 409 })
    mocks.tx.agentApproval.findUnique.mockResolvedValue({ ...approval, run: { ...approval.run, status: "cancelled" } })
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 409 })
  })
  it("rechecks coach relationships at decision time", async () => {
    mocks.security.mockRejectedValue(Object.assign(new Error("Revoked"), { status: 403 }))
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 403 })
    expect(mocks.tx.exerciseSet.updateMany).not.toHaveBeenCalled()
  })
  it("does not modify shared programs", async () => {
    mocks.tx.program.findUnique.mockResolvedValue({ ...program, assignments: [{ userId: "trainee" }, { userId: "other" }] })
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 403 })
  })
  it("does not edit targets while a workout session is open", async () => {
    mocks.tx.workoutSessionDraft.count.mockResolvedValue(1)
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 409 })
    expect(mocks.tx.exerciseSet.updateMany).not.toHaveBeenCalled()
  })
  it("reduces volume by removing only uncompleted tail sets", async () => {
    const sets = [1, 2, 3].map(setNumber => ({ id: `set-${setNumber}`, setNumber, completed: false, targetReps: 8, weight: 20, rir: 1 }))
    const current = { ...program, workouts: [{ exercises: [{ id: "exercise", sets }] }] }
    const preview = { programId: "program", version: fingerprint(current), changes: [], setCountChanges: [{ workoutExerciseId: "exercise", beforeCount: 3, afterCount: 2, beforeSets: sets }] }
    mocks.tx.program.findUnique.mockResolvedValue(current)
    mocks.tx.agentApproval.findUnique.mockResolvedValue({ ...approval, payload: preview, payloadHash: fingerprint(preview) })
    mocks.tx.exerciseSet.deleteMany.mockResolvedValue({ count: 1 })
    await decideApproval(actorId, "approval", fingerprint(preview), true)
    expect(mocks.tx.exerciseSet.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["set-3"] }, workoutExerciseId: "exercise", completed: false } })
    expect(mocks.tx.exerciseSet.createMany).not.toHaveBeenCalled()
  })
  it("adds volume by copying the final prescribed set without rebuilding the workout", async () => {
    const sets = [1, 2].map(setNumber => ({ id: `set-${setNumber}`, setNumber, completed: false, targetReps: 8, targetRepsMin: 6, weight: 20, rir: 1, intensityTag: null, notes: null }))
    const current = { ...program, workouts: [{ exercises: [{ id: "exercise", sets }] }] }
    const preview = { programId: "program", version: fingerprint(current), changes: [], setCountChanges: [{ workoutExerciseId: "exercise", beforeCount: 2, afterCount: 3, beforeSets: sets }] }
    mocks.tx.program.findUnique.mockResolvedValue(current)
    mocks.tx.agentApproval.findUnique.mockResolvedValue({ ...approval, payload: preview, payloadHash: fingerprint(preview) })
    await decideApproval(actorId, "approval", fingerprint(preview), true)
    expect(mocks.tx.exerciseSet.createMany.mock.calls[0][0].data).toMatchObject([{ workoutExerciseId: "exercise", setNumber: 3, targetReps: 8, weight: 20, completed: false }])
    expect(mocks.tx.exerciseSet.deleteMany).not.toHaveBeenCalled()
  })
  it("rejects proposal on another actor's run", async () => {
    await expect(decideApproval("someone", "approval", hash, true)).rejects.toMatchObject({ status: 404 })
    expect(mocks.security).not.toHaveBeenCalled()
  })
  it("rejects a set changed since preview", async () => {
    mocks.tx.exerciseSet.updateMany.mockResolvedValue({ count: 0 })
    await expect(decideApproval(actorId, "approval", hash, true)).rejects.toMatchObject({ status: 409 })
  })
  it("rejects without changing any plan targets", async () => {
    expect(await decideApproval(actorId, "approval", hash, false)).toEqual({ status: "rejected" })
    expect(mocks.tx.program.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.exerciseSet.updateMany).not.toHaveBeenCalled()
  })
  it("bounds target inputs and rejects invented properties", () => {
    const base = { subjectId: "00000000-0000-4000-8000-000000000001", programId: "00000000-0000-4000-8000-000000000002", reason: "Recovery", changes: [{ setId: "00000000-0000-4000-8000-000000000003", weight: -10 }] }
    expect(changesSchema.safeParse(base).success).toBe(false)
    expect(changesSchema.safeParse({ ...base, changes: [{ ...base.changes[0], weight: 20, completed: true }] }).success).toBe(false)
  })
})
