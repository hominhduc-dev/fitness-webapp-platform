import { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  assignmentCreateMany: vi.fn(),
  assignmentDelete: vi.fn(),
  assignmentFindUnique: vi.fn(),
  exerciseSetCreateMany: vi.fn(),
  notificationCreate: vi.fn(),
  programCreate: vi.fn(),
  programFindUnique: vi.fn(),
  variationFindUnique: vi.fn(),
  workoutCreateMany: vi.fn(),
  workoutExerciseCreateMany: vi.fn(),
  workoutExerciseUpdateMany: vi.fn(),
  workoutFindFirst: vi.fn(),
  workoutFindMany: vi.fn(),
  workoutLogUpdateMany: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    exerciseSet: { createMany: mocks.exerciseSetCreateMany },
    notification: { create: mocks.notificationCreate },
    program: { create: mocks.programCreate, findUnique: mocks.programFindUnique },
    programAssignment: {
      createMany: mocks.assignmentCreateMany,
      delete: mocks.assignmentDelete,
      findUnique: mocks.assignmentFindUnique,
    },
    variation: { findUnique: mocks.variationFindUnique },
    workout: { createMany: mocks.workoutCreateMany, findFirst: mocks.workoutFindFirst, findMany: mocks.workoutFindMany },
    workoutExercise: { createMany: mocks.workoutExerciseCreateMany, updateMany: mocks.workoutExerciseUpdateMany },
    workoutLog: { updateMany: mocks.workoutLogUpdateMany },
  }

  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})

import { swapExerciseForTraineeFromWorkout } from "./core"

const COACH_ID = "00000000-0000-4000-8000-0000000000c0"
const TRAINEE_ID = "00000000-0000-4000-8000-0000000000a0"
const ORIGINAL_PROGRAM_ID = "00000000-0000-4000-8000-0000000000b1"
const COPY_PROGRAM_ID = "00000000-0000-4000-8000-0000000000b2"
const WORKOUT_ID = "00000000-0000-4000-8000-0000000000c1"
const EXERCISE_ID = "00000000-0000-4000-8000-0000000000d1"
const OLD_VARIATION_ID = "00000000-0000-4000-8000-0000000000e1"
const NEW_VARIATION_ID = "00000000-0000-4000-8000-0000000000e2"

const trainee = { id: TRAINEE_ID, name: "Minh Duc", role: UserRole.trainee } as SerializedProfile

/** One exercise, one set — the smallest shape the fork loop will copy. */
function buildExercise() {
  return {
    id: EXERCISE_ID,
    notes: null,
    order: 0,
    originalVariationId: null,
    restTime: 90,
    sets: [
      {
        actualReps: null,
        completed: false,
        id: "00000000-0000-4000-8000-0000000000f1",
        intensityTag: null,
        notes: null,
        rir: null,
        setNumber: 1,
        targetReps: 8,
        targetRepsMin: null,
        weight: null,
      },
    ],
    variation: { exercise: { name: "Barbell Squat" }, id: OLD_VARIATION_ID, muscleTargets: [] },
    variationId: OLD_VARIATION_ID,
  }
}

/**
 * Arranges a swap against a program the coach created. `forkedFromProgramId`
 * is what separates the two cases: null is the coach's library original, a
 * value means the trainee is already working from a personalized copy.
 */
function arrangeSwap({ forkedFromProgramId, programId }: { forkedFromProgramId: string | null; programId: string }) {
  const program = {
    createdById: COACH_ID,
    description: null,
    difficulty: "advanced",
    duration: 1,
    forkedFromProgramId,
    googleSheetName: null,
    googleSpreadsheetId: null,
    id: programId,
    isAIGenerated: false,
    name: "Duc Bulking meso 4",
    workoutsPerWeek: 6,
  }

  const workout = {
    duration: 60,
    exercises: [buildExercise()],
    id: WORKOUT_ID,
    kind: null,
    name: "Day 1",
    notes: null,
    program,
    programId,
    scheduledDate: null,
    scheduledDay: 0,
    weekIndex: 0,
  }

  mocks.workoutFindFirst.mockResolvedValue(workout)
  mocks.variationFindUnique.mockResolvedValue({
    exercise: { name: "Hack Squat" },
    id: NEW_VARIATION_ID,
  })
  mocks.assignmentFindUnique.mockResolvedValue({
    assignedAt: new Date("2026-09-01T00:00:00.000Z"),
    programId,
    userId: TRAINEE_ID,
  })
  mocks.programFindUnique.mockResolvedValue({ ...program, workouts: [workout] })

  return { program, workout }
}

describe("trainee exercise swap — who ends up owning the copy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("forks the coach's original and keeps the coach as the owner", async () => {
    arrangeSwap({ forkedFromProgramId: null, programId: ORIGINAL_PROGRAM_ID })

    const result = await swapExerciseForTraineeFromWorkout(trainee, {
      newVariationId: NEW_VARIATION_ID,
      workoutExerciseId: EXERCISE_ID,
      workoutId: WORKOUT_ID,
    })

    expect(result.forkedProgramId).not.toBeNull()
    expect(mocks.programCreate).toHaveBeenCalledTimes(1)

    // The whole question: the new row carries the coach's id, not the trainee's.
    const created = mocks.programCreate.mock.calls[0][0].data
    expect(created.createdById).toBe(COACH_ID)
    expect(created.forkedFromProgramId).toBe(ORIGINAL_PROGRAM_ID)

    // The trainee's only claim on it is an assignment row.
    expect(mocks.assignmentCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: TRAINEE_ID })],
    })
  })

  /**
   * Characterization, not endorsement: this records what the code does today,
   * which is almost certainly wrong. Nothing in the swap path looks at
   * forkedFromProgramId, so a personalized copy is forked again exactly like a
   * library original — and because the transaction moves the assignment to the
   * new row, the copy the trainee just left keeps its whole workout tree with
   * nobody on it.
   *
   * Such an orphan is invisible in both coach views: the Library tab asks for
   * forkedFromProgramId: null, and the By client tab groups on assignments it
   * no longer has. Every swap therefore leaves the coach one more unreachable
   * program. Change this test with the fix.
   */
  it("forks a second time when the trainee swaps again inside the personalized copy", async () => {
    arrangeSwap({ forkedFromProgramId: ORIGINAL_PROGRAM_ID, programId: COPY_PROGRAM_ID })

    const result = await swapExerciseForTraineeFromWorkout(trainee, {
      newVariationId: NEW_VARIATION_ID,
      workoutExerciseId: EXERCISE_ID,
      workoutId: WORKOUT_ID,
    })

    expect(result.forkedProgramId).not.toBeNull()
    expect(mocks.programCreate).toHaveBeenCalledTimes(1)
    expect(mocks.programCreate.mock.calls[0][0].data.forkedFromProgramId).toBe(COPY_PROGRAM_ID)

    // And the copy the trainee was on loses its only assignment to the new one,
    // leaving a program row the coach owns and nobody is on.
    expect(mocks.assignmentDelete).toHaveBeenCalledWith({
      where: { programId_userId: { programId: COPY_PROGRAM_ID, userId: TRAINEE_ID } },
    })
    expect(mocks.programCreate.mock.calls[0][0].data.createdById).toBe(COACH_ID)
  })

  it("edits in place when the trainee owns the program, with no fork and no coach notification", async () => {
    const { program, workout } = arrangeSwap({ forkedFromProgramId: null, programId: ORIGINAL_PROGRAM_ID })
    mocks.workoutFindFirst.mockResolvedValue({ ...workout, program: { ...program, createdById: TRAINEE_ID } })
    mocks.workoutFindMany.mockResolvedValue([{ id: WORKOUT_ID, scheduledDay: 0, weekIndex: 0 }])

    const result = await swapExerciseForTraineeFromWorkout(trainee, {
      newVariationId: NEW_VARIATION_ID,
      workoutExerciseId: EXERCISE_ID,
      workoutId: WORKOUT_ID,
    })

    expect(result.forkedProgramId).toBeNull()
    expect(mocks.programCreate).not.toHaveBeenCalled()
    expect(mocks.notificationCreate).not.toHaveBeenCalled()
  })
})
