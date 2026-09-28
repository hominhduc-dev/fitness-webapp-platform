import { ExerciseShareStatus, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  exerciseFindFirst: vi.fn(),
  exerciseUpdate: vi.fn(),
  notifyAdmins: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    exercise: { findFirst: mocks.exerciseFindFirst, update: mocks.exerciseUpdate },
  }
  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})
vi.mock("../notifications/exercise-share-notifications", () => ({ notifyAdminsOfExerciseShare: mocks.notifyAdmins }))

import { canProfileAccessExercise, deleteCoachExercise, requestCoachExerciseShare, updateCoachExercise } from "./core"

const COACH_ID = "00000000-0000-4000-8000-0000000000c0"
const EXERCISE_ID = "00000000-0000-4000-8000-0000000000e1"
const coach = { id: COACH_ID, name: "Coach Khoa", role: UserRole.coach } as SerializedProfile
const otherCoach = { id: "00000000-0000-4000-8000-0000000000c9", name: "Coach Lan", role: UserRole.coach } as SerializedProfile
const trainee = { id: "00000000-0000-4000-8000-0000000000a0", name: "Minh", role: UserRole.trainee } as SerializedProfile

function coachExercise(shareStatus: ExerciseShareStatus) {
  return {
    createdAt: new Date(),
    createdBy: { name: coach.name },
    createdById: COACH_ID,
    id: EXERCISE_ID,
    muscleGroup: "Legs",
    name: "Tempo Hack Squat",
    shareReviewNote: null,
    shareStatus,
    updatedAt: new Date(),
    variations: [],
  }
}

describe("canProfileAccessExercise", () => {
  it("shows system and shared exercises to everyone, and a private one only to its coach", () => {
    const system = { createdById: null, shareStatus: ExerciseShareStatus.private }
    const shared = { createdById: COACH_ID, shareStatus: ExerciseShareStatus.shared }

    for (const profile of [coach, otherCoach, trainee]) {
      expect(canProfileAccessExercise(system, profile)).toBe(true)
      expect(canProfileAccessExercise(shared, profile)).toBe(true)
    }
    for (const status of [ExerciseShareStatus.private, ExerciseShareStatus.pending, ExerciseShareStatus.rejected]) {
      const own = { createdById: COACH_ID, shareStatus: status }
      expect(canProfileAccessExercise(own, coach)).toBe(true)
      expect(canProfileAccessExercise(own, otherCoach)).toBe(false)
      expect(canProfileAccessExercise(own, trainee)).toBe(false)
    }
  })
})

describe("requestCoachExerciseShare", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
  })

  it("queues a private exercise for review and tells the admins", async () => {
    mocks.exerciseFindFirst.mockResolvedValue(coachExercise(ExerciseShareStatus.private))
    mocks.exerciseUpdate.mockResolvedValue(coachExercise(ExerciseShareStatus.pending))

    const result = await requestCoachExerciseShare(coach, EXERCISE_ID)

    expect(mocks.exerciseFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { createdById: COACH_ID, id: EXERCISE_ID } }))
    expect(mocks.exerciseUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shareStatus: ExerciseShareStatus.pending }),
      where: { id: EXERCISE_ID },
    }))
    expect(mocks.notifyAdmins).toHaveBeenCalledWith({ coachName: coach.name, exercises: [expect.objectContaining({ id: EXERCISE_ID })] })
    expect(result.shareStatus).toBe(ExerciseShareStatus.pending)
  })

  it("lets a declined exercise be offered again", async () => {
    mocks.exerciseFindFirst.mockResolvedValue(coachExercise(ExerciseShareStatus.rejected))
    mocks.exerciseUpdate.mockResolvedValue(coachExercise(ExerciseShareStatus.pending))

    await requestCoachExerciseShare(coach, EXERCISE_ID)

    expect(mocks.exerciseUpdate).toHaveBeenCalled()
  })

  it("does not notify the admins twice for the same request", async () => {
    mocks.exerciseFindFirst.mockResolvedValue(coachExercise(ExerciseShareStatus.pending))

    await requestCoachExerciseShare(coach, EXERCISE_ID)

    expect(mocks.exerciseUpdate).not.toHaveBeenCalled()
    expect(mocks.notifyAdmins).not.toHaveBeenCalled()
  })

  it("rejects another coach's exercise", async () => {
    mocks.exerciseFindFirst.mockResolvedValue(null)

    await expect(requestCoachExerciseShare(otherCoach, EXERCISE_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe("a shared exercise", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.exerciseFindFirst.mockResolvedValue({ ...coachExercise(ExerciseShareStatus.shared), variations: [] })
  })

  it("can no longer be edited by its coach", async () => {
    await expect(
      updateCoachExercise(coach, EXERCISE_ID, {
        muscleGroup: "Legs",
        muscleProfile: { activityType: "strength", primaryMuscles: ["quadriceps"], secondaryMuscles: [] },
        name: "Tempo Hack Squat",
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it("can no longer be deleted by its coach", async () => {
    await expect(deleteCoachExercise(coach, EXERCISE_ID)).rejects.toMatchObject({ status: 403 })
  })
})
