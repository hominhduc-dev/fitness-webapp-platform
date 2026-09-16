import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "./auth.service"

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
}))
vi.mock("./fitness-data/shared/guards", () => ({
  assertCoach: vi.fn(),
  assertCoachOwnsTrainee: vi.fn(),
  assertTrainee: vi.fn(),
  ensurePrisma: () => ({
    workout: { findFirst: mocks.findFirst },
    workoutSessionDraft: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, upsert: mocks.upsert },
  }),
}))
import { upsertWorkoutSessionDraftForTrainee } from "./fitness-data/core"

const trainee = { id: "trainee", role: "trainee" } as SerializedProfile
const startedAt = "2026-09-16T09:18:00.000Z"
const input = { currentExerciseIndex: 0, exercises: [], startedAt }
const draftRecord = {
  currentExerciseIndex: 0,
  deletedSetIds: [],
  exercises: [],
  schemaVersion: null,
  startedAt: new Date(startedAt),
  updatedAt: new Date("2026-09-16T09:20:00.000Z"),
  workoutId: "workout",
  workoutName: "Push",
}

describe("upsertWorkoutSessionDraftForTrainee", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findFirst.mockResolvedValue({ id: "workout", name: "Push" })
  })

  it("creates the draft for a session that was never synced", async () => {
    mocks.upsert.mockResolvedValue(draftRecord)

    await expect(upsertWorkoutSessionDraftForTrainee(trainee, "workout", input)).resolves.toMatchObject({ workoutId: "workout" })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it("refuses to recreate a synced draft that was discarded on another device", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      upsertWorkoutSessionDraftForTrainee(trainee, "workout", { ...input, baseUpdatedAt: "2026-09-16T09:19:00.000Z" }),
    ).rejects.toMatchObject({ code: "WORKOUT_SESSION_DRAFT_DISCARDED", status: 409 })
    expect(mocks.updateMany.mock.calls[0][0].where).toMatchObject({ startedAt: new Date(startedAt), userId: "trainee", workoutId: "workout" })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it("updates the same session when it still exists", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.findUnique.mockResolvedValue(draftRecord)

    await expect(
      upsertWorkoutSessionDraftForTrainee(trainee, "workout", { ...input, baseUpdatedAt: "2026-09-16T09:19:00.000Z" }),
    ).resolves.toMatchObject({ updatedAt: "2026-09-16T09:20:00.000Z" })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
