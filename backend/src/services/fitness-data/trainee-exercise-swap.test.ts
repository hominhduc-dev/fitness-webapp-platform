import { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  overrideFindMany: vi.fn(),
  overrideFindUnique: vi.fn(),
  overrideUpsert: vi.fn(),
  programCreate: vi.fn(),
  programFindUnique: vi.fn(),
  variationFindUnique: vi.fn(),
  workoutExerciseFindMany: vi.fn(),
  workoutExerciseUpdateMany: vi.fn(),
  workoutFindFirst: vi.fn(),
  workoutFindMany: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    notification: { create: mocks.notificationCreate },
    program: { create: mocks.programCreate, findUnique: mocks.programFindUnique },
    traineeExerciseOverride: {
      findMany: mocks.overrideFindMany,
      findUnique: mocks.overrideFindUnique,
      upsert: mocks.overrideUpsert,
    },
    variation: { findUnique: mocks.variationFindUnique },
    workout: { findFirst: mocks.workoutFindFirst, findMany: mocks.workoutFindMany },
    workoutExercise: { findMany: mocks.workoutExerciseFindMany, updateMany: mocks.workoutExerciseUpdateMany },
  }

  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})

import { applyTraineeExerciseOverrides, swapExerciseForTraineeFromWorkout } from "./core"

const COACH_ID = "00000000-0000-4000-8000-0000000000c0"
const TRAINEE_ID = "00000000-0000-4000-8000-0000000000a0"
const PROGRAM_ID = "00000000-0000-4000-8000-0000000000b1"
const WORKOUT_ID = "00000000-0000-4000-8000-0000000000c1"
const LATER_WORKOUT_ID = "00000000-0000-4000-8000-0000000000c2"
const EXERCISE_ID = "00000000-0000-4000-8000-0000000000d1"
const LATER_EXERCISE_ID = "00000000-0000-4000-8000-0000000000d2"
const COACH_VARIATION_ID = "00000000-0000-4000-8000-0000000000e1"
const NEW_VARIATION_ID = "00000000-0000-4000-8000-0000000000e2"
const SUBSTITUTE_VARIATION_ID = "00000000-0000-4000-8000-0000000000e3"

const trainee = { id: TRAINEE_ID, name: "Minh Duc", role: UserRole.trainee } as SerializedProfile

const swapInput = {
  newVariationId: NEW_VARIATION_ID,
  workoutExerciseId: EXERCISE_ID,
  workoutId: WORKOUT_ID,
}

/**
 * A coach program with the same exercise in this workout and in a later one,
 * which is the scope a swap is supposed to cover.
 */
function arrangeCoachProgram({ createdById = COACH_ID } = {}) {
  const program = { createdById, forkedFromProgramId: null, id: PROGRAM_ID, name: "Duc Bulking meso 4" }

  const targetExercise = {
    id: EXERCISE_ID,
    order: 0,
    originalVariationId: null,
    variation: { exercise: { name: "Barbell Squat" }, id: COACH_VARIATION_ID, muscleTargets: [] },
    variationId: COACH_VARIATION_ID,
  }

  mocks.workoutFindFirst.mockResolvedValue({
    exercises: [targetExercise],
    id: WORKOUT_ID,
    program,
    programId: PROGRAM_ID,
    scheduledDay: 0,
    weekIndex: 0,
  })
  mocks.workoutFindMany.mockResolvedValue([
    { id: WORKOUT_ID, scheduledDay: 0, weekIndex: 0 },
    { id: LATER_WORKOUT_ID, scheduledDay: 3, weekIndex: 0 },
  ])
  mocks.workoutExerciseFindMany.mockResolvedValue([
    { id: EXERCISE_ID, variationId: COACH_VARIATION_ID, workoutId: WORKOUT_ID },
    { id: LATER_EXERCISE_ID, variationId: COACH_VARIATION_ID, workoutId: LATER_WORKOUT_ID },
  ])
  mocks.overrideFindUnique.mockResolvedValue(null)
  mocks.overrideFindMany.mockResolvedValue([])
  mocks.variationFindUnique.mockResolvedValue({ exercise: { name: "Hack Squat" }, id: NEW_VARIATION_ID })

  return { program, targetExercise }
}

describe("trainee exercise swap", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("records an override per slot instead of copying the coach's program", async () => {
    arrangeCoachProgram()

    const result = await swapExerciseForTraineeFromWorkout(trainee, swapInput)

    // The change the whole model turns on: nothing is forked.
    expect(mocks.programCreate).not.toHaveBeenCalled()
    expect(mocks.workoutExerciseUpdateMany).not.toHaveBeenCalled()
    expect(result.forkedProgramId).toBeNull()
    expect(result.workoutId).toBe(WORKOUT_ID)

    // This slot and its later recurrence, and nothing else.
    expect(mocks.overrideUpsert).toHaveBeenCalledTimes(2)
    expect(mocks.overrideUpsert.mock.calls.map((call) => call[0].create.workoutExerciseId)).toEqual([
      EXERCISE_ID,
      LATER_EXERCISE_ID,
    ])
    expect(mocks.overrideUpsert.mock.calls[0][0].create).toMatchObject({
      replacedVariationId: COACH_VARIATION_ID,
      userId: TRAINEE_ID,
      variationId: NEW_VARIATION_ID,
    })
  })

  it("tells the coach, naming their own program and their own row", async () => {
    arrangeCoachProgram()

    await swapExerciseForTraineeFromWorkout(trainee, swapInput)

    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1)
    const notification = mocks.notificationCreate.mock.calls[0][0].data
    expect(notification.userId).toBe(COACH_ID)
    expect(notification.metadata).toMatchObject({
      kind: "trainee_swapped_exercise",
      newVariationId: NEW_VARIATION_ID,
      // Approving edits the coach's rows in place, so there is no other program
      // to resolve to any more.
      originalProgramId: PROGRAM_ID,
      originalWorkoutId: WORKOUT_ID,
      traineeId: TRAINEE_ID,
    })
  })

  /**
   * A second swap starts from what the trainee is looking at, which is their
   * own substitute — the coach's row still holds the original. Matching the
   * scope on the coach's row would find nothing and silently swap nothing.
   */
  it("matches a second swap against the substitute the trainee can see", async () => {
    arrangeCoachProgram()
    mocks.overrideFindUnique.mockResolvedValue({
      replacedVariationId: COACH_VARIATION_ID,
      variationId: SUBSTITUTE_VARIATION_ID,
    })
    mocks.overrideFindMany.mockResolvedValue([
      { variationId: SUBSTITUTE_VARIATION_ID, workoutExerciseId: EXERCISE_ID },
      { variationId: SUBSTITUTE_VARIATION_ID, workoutExerciseId: LATER_EXERCISE_ID },
    ])

    await swapExerciseForTraineeFromWorkout(trainee, swapInput)

    expect(mocks.overrideUpsert).toHaveBeenCalledTimes(2)
    // replacedVariationId still tracks the coach's row, not the substitute it
    // is replacing, so a later coach edit can be told apart from this swap.
    expect(mocks.overrideUpsert.mock.calls[0][0].update).toMatchObject({
      replacedVariationId: COACH_VARIATION_ID,
      variationId: NEW_VARIATION_ID,
    })

    // The coach is asked to move their own row, which still holds the original.
    expect(mocks.notificationCreate.mock.calls[0][0].data.metadata).toMatchObject({
      oldVariationId: COACH_VARIATION_ID,
    })
  })

  it("refuses a swap to the variation the trainee is already doing", async () => {
    arrangeCoachProgram()
    mocks.overrideFindUnique.mockResolvedValue({
      replacedVariationId: COACH_VARIATION_ID,
      variationId: NEW_VARIATION_ID,
    })

    await expect(swapExerciseForTraineeFromWorkout(trainee, swapInput)).rejects.toThrow(/trùng variation hiện tại/)
    expect(mocks.overrideUpsert).not.toHaveBeenCalled()
  })

  it("edits the rows directly when the program is the trainee's own", async () => {
    arrangeCoachProgram({ createdById: TRAINEE_ID })

    const result = await swapExerciseForTraineeFromWorkout(trainee, swapInput)

    expect(mocks.workoutExerciseUpdateMany).toHaveBeenCalled()
    expect(mocks.overrideUpsert).not.toHaveBeenCalled()
    expect(mocks.notificationCreate).not.toHaveBeenCalled()
    expect(result.forkedProgramId).toBeNull()
  })
})

describe("reading a coach program back for a trainee", () => {
  const substitute = {
    exercise: { name: "Hack Squat" },
    id: SUBSTITUTE_VARIATION_ID,
    muscleTargets: [],
  }

  /**
   * Trimmed to the four fields the helper reads and writes. The cast is the
   * fixture admitting it is partial — widening the helper's own parameter type
   * to fit would stop it from type-checking against the real records its
   * callers pass.
   */
  const buildWorkout = () =>
    ({
      exercises: [
        {
          id: EXERCISE_ID,
          order: 0,
          originalVariationId: null,
          variation: { exercise: { name: "Barbell Squat" }, id: COACH_VARIATION_ID, muscleTargets: [] },
          variationId: COACH_VARIATION_ID,
        },
      ],
    }) as unknown as Parameters<typeof applyTraineeExerciseOverrides>[0][number]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("substitutes the trainee's choice and remembers what it replaced", async () => {
    mocks.overrideFindMany.mockResolvedValue([
      {
        replacedVariationId: COACH_VARIATION_ID,
        variation: substitute,
        variationId: SUBSTITUTE_VARIATION_ID,
        workoutExerciseId: EXERCISE_ID,
      },
    ])

    const [workout] = await applyTraineeExerciseOverrides([buildWorkout()], TRAINEE_ID)

    expect(workout.exercises[0].variationId).toBe(SUBSTITUTE_VARIATION_ID)
    expect(workout.exercises[0].variation).toBe(substitute)
    expect(workout.exercises[0].originalVariationId).toBe(COACH_VARIATION_ID)
  })

  /**
   * The coach moved this slot on to a third exercise after the trainee
   * substituted it. Reinstating the substitute would quietly undo the coach's
   * newer decision, so the stale row is ignored.
   */
  it("ignores an override the coach's program has moved past", async () => {
    mocks.overrideFindMany.mockResolvedValue([
      {
        replacedVariationId: "00000000-0000-4000-8000-0000000000ff",
        variation: substitute,
        variationId: SUBSTITUTE_VARIATION_ID,
        workoutExerciseId: EXERCISE_ID,
      },
    ])

    const [workout] = await applyTraineeExerciseOverrides([buildWorkout()], TRAINEE_ID)

    expect(workout.exercises[0].variationId).toBe(COACH_VARIATION_ID)
    expect(workout.exercises[0].originalVariationId).toBeNull()
  })

  it("does not query at all when there are no exercises to match", async () => {
    await applyTraineeExerciseOverrides([{ exercises: [] }], TRAINEE_ID)

    expect(mocks.overrideFindMany).not.toHaveBeenCalled()
  })
})
