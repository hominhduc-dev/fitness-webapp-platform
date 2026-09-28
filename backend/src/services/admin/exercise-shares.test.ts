import { ExerciseShareStatus, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  exerciseDelete: vi.fn(),
  exerciseFindUnique: vi.fn(),
  exerciseUpdate: vi.fn(),
  invalidate: vi.fn(),
  notifyCoach: vi.fn(),
  overrideUpdateMany: vi.fn(),
  variationFindUnique: vi.fn(),
  workoutExerciseUpdateMany: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    adminAuditLog: { create: mocks.auditCreate },
    exercise: { delete: mocks.exerciseDelete, findUnique: mocks.exerciseFindUnique, update: mocks.exerciseUpdate },
    traineeExerciseOverride: { updateMany: mocks.overrideUpdateMany },
    variation: { findUnique: mocks.variationFindUnique },
    workoutExercise: { updateMany: mocks.workoutExerciseUpdateMany },
  }
  return { prisma: db }
})
vi.mock("../../lib/library-cache", () => ({ invalidateExerciseLibrary: mocks.invalidate }))
vi.mock("../notifications/exercise-share-notifications", () => ({ notifyCoachOfExerciseShareReview: mocks.notifyCoach }))

import { mapMergedVariations, reviewAdminExerciseShare } from "./exercise-shares"

const admin = { id: "00000000-0000-4000-8000-0000000000ad", name: "Admin", role: UserRole.admin } as SerializedProfile
const coach = { id: "00000000-0000-4000-8000-0000000000c0", name: "Coach", role: UserRole.coach } as SerializedProfile
const EXERCISE_ID = "00000000-0000-4000-8000-0000000000e1"

const pendingExercise = (shareStatus: ExerciseShareStatus = ExerciseShareStatus.pending) => ({
  createdById: coach.id,
  id: EXERCISE_ID,
  name: "Tempo Hack Squat",
  shareStatus,
  variations: [{ id: "src-default", name: "Default" }, { id: "src-wide", name: "Wide Stance" }],
})

describe("mapMergedVariations", () => {
  it("matches variations by name and sends the rest to the chosen one", () => {
    expect(
      mapMergedVariations(
        [{ id: "a", name: "Default" }, { id: "b", name: " wide stance " }, { id: "c", name: "Paused" }],
        { chosenVariationId: "t-default", variations: [{ id: "t-default", name: "Default" }, { id: "t-wide", name: "Wide Stance" }] },
      ),
    ).toEqual([
      { from: "a", to: "t-default" },
      { from: "b", to: "t-wide" },
      { from: "c", to: "t-default" },
    ])
  })
})

describe("reviewAdminExerciseShare", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.exerciseFindUnique.mockResolvedValue(pendingExercise())
  })

  it("only lets admins decide", async () => {
    await expect(reviewAdminExerciseShare(coach, EXERCISE_ID, { decision: "approve" })).rejects.toMatchObject({ status: 403 })
  })

  it("shares an approved exercise and tells its coach", async () => {
    const result = await reviewAdminExerciseShare(admin, EXERCISE_ID, { decision: "approve" })

    expect(mocks.exerciseUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ shareReviewedById: admin.id, shareStatus: ExerciseShareStatus.shared }),
      where: { id: EXERCISE_ID },
    })
    expect(mocks.invalidate).toHaveBeenCalled()
    expect(mocks.notifyCoach).toHaveBeenCalledWith(expect.objectContaining({ coachId: coach.id, decision: "approved" }))
    expect(result).toEqual({ decision: "approved", exerciseId: EXERCISE_ID, targetExerciseId: null })
  })

  it("keeps a declined exercise private, with the admin's note", async () => {
    await reviewAdminExerciseShare(admin, EXERCISE_ID, { decision: "reject", note: "  Trùng Hack Squat " })

    expect(mocks.exerciseUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({ shareReviewNote: "Trùng Hack Squat", shareStatus: ExerciseShareStatus.rejected }),
      where: { id: EXERCISE_ID },
    })
  })

  it("does not decide twice", async () => {
    mocks.exerciseFindUnique.mockResolvedValue(pendingExercise(ExerciseShareStatus.shared))

    await expect(reviewAdminExerciseShare(admin, EXERCISE_ID, { decision: "approve" })).rejects.toMatchObject({ status: 409 })
    expect(mocks.exerciseUpdate).not.toHaveBeenCalled()
  })

  it("moves every workout and swap onto the library exercise, then deletes the copy", async () => {
    mocks.variationFindUnique.mockResolvedValue({
      exercise: { createdById: null, name: "Hack Squat", shareStatus: ExerciseShareStatus.private, variations: [{ id: "t-default", name: "Default" }] },
      exerciseId: "target-exercise",
      id: "t-default",
    })

    const result = await reviewAdminExerciseShare(admin, EXERCISE_ID, { decision: "merge", targetVariationId: "t-default" })

    for (const from of ["src-default", "src-wide"]) {
      expect(mocks.workoutExerciseUpdateMany).toHaveBeenCalledWith({ data: { variationId: "t-default" }, where: { variationId: from } })
      expect(mocks.workoutExerciseUpdateMany).toHaveBeenCalledWith({ data: { originalVariationId: "t-default" }, where: { originalVariationId: from } })
      expect(mocks.overrideUpdateMany).toHaveBeenCalledWith({ data: { variationId: "t-default" }, where: { variationId: from } })
      expect(mocks.overrideUpdateMany).toHaveBeenCalledWith({ data: { replacedVariationId: "t-default" }, where: { replacedVariationId: from } })
    }
    expect(mocks.exerciseDelete).toHaveBeenCalledWith({ where: { id: EXERCISE_ID } })
    expect(mocks.notifyCoach).toHaveBeenCalledWith(expect.objectContaining({ decision: "merged", targetName: "Hack Squat" }))
    expect(result).toEqual({ decision: "merged", exerciseId: EXERCISE_ID, targetExerciseId: "target-exercise" })
  })

  it("refuses to merge into another coach's private exercise", async () => {
    mocks.variationFindUnique.mockResolvedValue({
      exercise: { createdById: "other-coach", name: "Hack Squat", shareStatus: ExerciseShareStatus.private, variations: [] },
      exerciseId: "target-exercise",
      id: "t-default",
    })

    await expect(
      reviewAdminExerciseShare(admin, EXERCISE_ID, { decision: "merge", targetVariationId: "t-default" }),
    ).rejects.toMatchObject({ status: 400 })
    expect(mocks.exerciseDelete).not.toHaveBeenCalled()
  })
})
