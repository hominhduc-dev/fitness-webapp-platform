import { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  notificationFindFirst: vi.fn(),
  notificationFindMany: vi.fn(),
  notificationUpdate: vi.fn(),
  overrideDeleteMany: vi.fn(),
  overrideFindMany: vi.fn(),
  overrideFindUnique: vi.fn(),
  overrideUpdateMany: vi.fn(),
  overrideUpsert: vi.fn(),
  programCreate: vi.fn(),
  programFindFirst: vi.fn(),
  programFindUnique: vi.fn(),
  queuePush: vi.fn(),
  variationFindUnique: vi.fn(),
  workoutExerciseFindMany: vi.fn(),
  workoutExerciseUpdateMany: vi.fn(),
  workoutFindFirst: vi.fn(),
  workoutFindMany: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    notification: {
      create: mocks.notificationCreate,
      findFirst: mocks.notificationFindFirst,
      findMany: mocks.notificationFindMany,
      update: mocks.notificationUpdate,
    },
    program: { create: mocks.programCreate, findFirst: mocks.programFindFirst, findUnique: mocks.programFindUnique },
    traineeExerciseOverride: {
      deleteMany: mocks.overrideDeleteMany,
      findMany: mocks.overrideFindMany,
      findUnique: mocks.overrideFindUnique,
      updateMany: mocks.overrideUpdateMany,
      upsert: mocks.overrideUpsert,
    },
    variation: { findUnique: mocks.variationFindUnique },
    workout: { findFirst: mocks.workoutFindFirst, findMany: mocks.workoutFindMany },
    workoutExercise: { findMany: mocks.workoutExerciseFindMany, updateMany: mocks.workoutExerciseUpdateMany },
  }

  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})

vi.mock("../notifications/notification-dispatch.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  queuePushForNotifications: mocks.queuePush,
}))

import { applyTraineeExerciseOverrides, approveTraineeExerciseSwapForCoach, swapExerciseForTraineeFromWorkout } from "./core"

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
  mocks.notificationCreate.mockResolvedValue({ id: "new-notification" })
  mocks.notificationFindMany.mockResolvedValue([])
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

    // Pushed to the coach's devices, not only listed in the bell, and a tap
    // opens the trainee.
    expect(mocks.queuePush).toHaveBeenCalledWith([{ id: "new-notification" }])
    expect(mocks.notificationCreate.mock.calls[0][0].data.metadata).toMatchObject({
      programName: "Duc Bulking meso 4",
      url: `/coach/trainees/${TRAINEE_ID}`,
    })

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

  it("retires the trainee's unanswered request for the same exercise", async () => {
    arrangeCoachProgram()
    const pending = { kind: "trainee_swapped_exercise", oldVariationId: COACH_VARIATION_ID, traineeId: TRAINEE_ID }
    mocks.notificationFindMany.mockResolvedValue([
      { id: "older", metadata: pending, readAt: null },
      { id: "answered", metadata: { ...pending, approvedAt: "2026-09-01T00:00:00.000Z" }, readAt: null },
      { id: "other-trainee", metadata: { ...pending, traineeId: "someone-else" }, readAt: null },
      { id: "other-exercise", metadata: { ...pending, oldVariationId: SUBSTITUTE_VARIATION_ID }, readAt: null },
    ])

    await swapExerciseForTraineeFromWorkout(trainee, swapInput)

    expect(mocks.notificationUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.notificationUpdate.mock.calls[0][0]).toMatchObject({
      data: {
        metadata: { ...pending, supersededByNotificationId: "new-notification", supersededAt: expect.any(String) },
        readAt: expect.any(Date),
      },
      where: { id: "older" },
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

describe("coach approving a trainee's swap", () => {
  const coach = { id: COACH_ID, name: "Coach", role: UserRole.coach } as SerializedProfile
  const request = {
    kind: "trainee_swapped_exercise",
    newVariationId: NEW_VARIATION_ID,
    oldVariationId: COACH_VARIATION_ID,
    originalProgramId: PROGRAM_ID,
    originalWorkoutId: WORKOUT_ID,
    targetOrder: 0,
    traineeId: TRAINEE_ID,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.programFindFirst.mockResolvedValue({
      id: PROGRAM_ID,
      workouts: [
        { exercises: [{ id: EXERCISE_ID, order: 0, variationId: COACH_VARIATION_ID }], id: WORKOUT_ID, scheduledDay: 0, weekIndex: 0 },
        { exercises: [{ id: LATER_EXERCISE_ID, order: 0, variationId: COACH_VARIATION_ID }], id: LATER_WORKOUT_ID, scheduledDay: 3, weekIndex: 0 },
      ],
    })
  })

  it("keeps a slot the trainee has since swapped to something else", async () => {
    mocks.notificationFindFirst.mockResolvedValue({ id: "request", metadata: request, readAt: null })

    await approveTraineeExerciseSwapForCoach(coach, "request")

    const slots = { in: [EXERCISE_ID, LATER_EXERCISE_ID] }
    // Only overrides that already match the approved exercise are redundant.
    expect(mocks.overrideDeleteMany).toHaveBeenCalledWith({
      where: { userId: TRAINEE_ID, variationId: NEW_VARIATION_ID, workoutExerciseId: slots },
    })
    // Any other substitution now stands in for the approved row, so it stays live.
    expect(mocks.overrideUpdateMany).toHaveBeenCalledWith({
      data: { replacedVariationId: NEW_VARIATION_ID },
      where: { userId: TRAINEE_ID, workoutExerciseId: slots },
    })
  })

  it("refuses a request a newer swap has replaced", async () => {
    mocks.notificationFindFirst.mockResolvedValue({
      id: "request",
      metadata: { ...request, supersededAt: "2026-09-30T00:00:00.000Z" },
      readAt: null,
    })

    await expect(approveTraineeExerciseSwapForCoach(coach, "request")).rejects.toThrow(/yêu cầu mới nhất/)
    expect(mocks.workoutExerciseUpdateMany).not.toHaveBeenCalled()
  })
})
