import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "./auth.service"

const { db, tx, provider } = vi.hoisted(() => {
  const tx = {
    program: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    programAssignment: { create: vi.fn() }, workout: { create: vi.fn() },
    workoutExercise: { create: vi.fn() }, exerciseSet: { createMany: vi.fn() },
    aIGeneration: { update: vi.fn() },
  }
  return {
    tx,
    db: { aIGeneration: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() }, exercise: { findMany: vi.fn() }, workoutLog: { findMany: vi.fn() }, $transaction: vi.fn() },
    provider: { generateStructuredJSON: vi.fn() },
  }
})
vi.mock("../lib/prisma", () => ({ prisma: db, retryTransaction: (fn: () => unknown) => fn() }))
vi.mock("../lib/ai/ai-client", () => ({ getAIProvider: () => provider }))

import { acceptAIProgram, generateWorkoutProgram } from "./ai.service"

const profile = { id: "user-1" } as SerializedProfile
function generation(exercise: Record<string, unknown>) {
  return { id: "gen-1", userId: profile.id, type: "workout_program", status: "completed", output: { mapped: {
    name: "Test", description: "", difficulty: "beginner", duration: 1, workoutsPerWeek: 2,
    workouts: [{ name: "Day 1", weekIndex: 0, scheduledDay: 1, duration: 30, exercises: [{ variationId: "v1", ...exercise }] }],
  } } }
}
describe("AI workout validation boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.$transaction.mockImplementation(async (fn: (value: typeof tx) => unknown) => fn(tx))
    tx.program.findUniqueOrThrow.mockResolvedValue({ id: "saved-program" })
  })

  it("accepts the reported legacy payload with three non-null targetReps values", async () => {
    db.aIGeneration.findUnique.mockResolvedValue(generation({ sets: 3, repsMin: 30 }))
    await expect(acceptAIProgram(profile, "gen-1")).resolves.toEqual({ id: "saved-program" })
    expect(tx.exerciseSet.createMany).toHaveBeenCalledWith({ data: [1, 2, 3].map((setNumber) => expect.objectContaining({ setNumber, targetReps: 30, targetRepsMin: 30 })) })
    expect(tx.aIGeneration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "accepted" }) }))
  })

  it("rejects missing reps before starting any write transaction", async () => {
    db.aIGeneration.findUnique.mockResolvedValue(generation({ sets: 3 }))
    await expect(acceptAIProgram(profile, "gen-1")).rejects.toMatchObject({ status: 422 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a meal generation at the program endpoint", async () => {
    db.aIGeneration.findUnique.mockResolvedValue({ ...generation({ sets: 3, reps: 10 }), type: "meal_plan" })
    await expect(acceptAIProgram(profile, "gen-1")).rejects.toMatchObject({ status: 400 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("marks invalid model output failed rather than leaving a pending generation", async () => {
    db.aIGeneration.count.mockResolvedValue(0)
    db.aIGeneration.create.mockResolvedValue({ id: "new-gen" })
    db.exercise.findMany.mockResolvedValue([{ id: "e1", name: "Squat", muscleGroup: "legs", createdById: null, variations: [{ id: "v1", name: "Default", equipment: null }] }])
    db.workoutLog.findMany.mockResolvedValue([])
    provider.generateStructuredJSON.mockResolvedValue({ data: { workouts: [{ exercises: [{ exerciseName: "Squat", sets: 3 }] }] }, tokenUsage: 10 })
    await expect(generateWorkoutProgram(profile, { daysPerWeek: 2, durationWeeks: 1, goal: "strength", experienceLevel: "beginner", sessionDuration: 30, availableEquipment: "bodyweight" }))
      .rejects.toMatchObject({ status: 422 })
    expect(db.aIGeneration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
})
