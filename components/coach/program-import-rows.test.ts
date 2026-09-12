import { describe, expect, it } from "vitest"

import { buildWorkoutsFromRows } from "@/components/coach/program-import-rows"
import type { ProgramImportRow } from "@/components/coach/program-import-rows"
import type { ExerciseVariationOption } from "@/lib/fitness/types"

/**
 * Exercise library fixtures.
 *
 * "Squat" has two variations so it only resolves when the row names one or when
 * the default is marked; "Bench Press" has a single variation so the exercise
 * name alone is enough. Both paths matter: Notion rows often leave Variation
 * blank.
 */
function option(overrides: Partial<ExerciseVariationOption> & { id: string }): ExerciseVariationOption {
  return {
    activityType: "strength",
    canManage: true,
    createdById: null,
    equipment: null,
    exerciseId: `exercise-${overrides.id}`,
    exerciseName: "Bench Press",
    isDefault: true,
    metadata: undefined,
    muscleGroup: "chest",
    name: "Bench Press",
    primaryMuscles: [],
    secondaryMuscles: [],
    sortOrder: 0,
    source: "system",
    variationName: "Default",
    ...overrides,
  } as ExerciseVariationOption
}

const EXERCISES: ExerciseVariationOption[] = [
  option({ id: "bench-default" }),
  option({
    exerciseId: "exercise-squat",
    exerciseName: "Squat",
    id: "squat-barbell",
    isDefault: true,
    name: "Squat (Barbell)",
    variationName: "Barbell",
  }),
  option({
    exerciseId: "exercise-squat",
    exerciseName: "Squat",
    id: "squat-goblet",
    isDefault: false,
    name: "Squat (Goblet)",
    variationName: "Goblet",
  }),
]

function row(overrides: Partial<ProgramImportRow> & { sourceRow: number }): ProgramImportRow {
  return {
    exerciseName: "Bench Press",
    reps: "8",
    scheduledDay: 1,
    sets: 3,
    variationName: "",
    workoutName: "Push",
    ...overrides,
  }
}

describe("buildWorkoutsFromRows", () => {
  it("repeats a template week for every week of the program", () => {
    const { issues, workouts } = buildWorkoutsFromRows(
      [row({ sourceRow: 1 }), row({ scheduledDay: 2, sourceRow: 2, workoutName: "Pull" })],
      EXERCISES,
      { duration: 4 },
    )

    expect(issues).toEqual([])
    expect(workouts).toHaveLength(8)
    // Sorted for the review screen: both days of week 1, then both of week 2.
    // weekIndex counts from 0, matching every other producer of a program.
    expect(workouts.map((workout) => workout.weekIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(workouts.map((workout) => workout.scheduledDay)).toEqual([1, 2, 1, 2, 1, 2, 1, 2])
  })

  it("keeps explicit weeks and does not repeat them", () => {
    const { issues, workouts } = buildWorkoutsFromRows(
      [
        row({ rir: 3, sourceRow: 1, week: 1 }),
        row({ rir: 1, sourceRow: 2, week: 3 }),
      ],
      EXERCISES,
      { duration: 4 },
    )

    expect(issues).toEqual([])
    expect(workouts).toHaveLength(2)
    // The source counts weeks from 1, so its weeks 1 and 3 are indexes 0 and 2.
    expect(workouts.map((workout) => workout.weekIndex)).toEqual([0, 2])
    expect(workouts.map((workout) => workout.exercises[0]?.rir)).toEqual([3, 1])
  })

  it("groups rows sharing a week, day and workout name into one workout", () => {
    const { workouts } = buildWorkoutsFromRows(
      [row({ sourceRow: 1, week: 1 }), row({ exerciseName: "Squat", sourceRow: 2, week: 1 })],
      EXERCISES,
      { duration: 1 },
    )

    expect(workouts).toHaveLength(1)
    expect(workouts[0].exercises).toHaveLength(2)
  })

  it("parses a rep range into repsMin and reps", () => {
    const { workouts } = buildWorkoutsFromRows([row({ reps: "8-12", sourceRow: 1 })], EXERCISES, { duration: 1 })

    expect(workouts[0].exercises[0]).toMatchObject({ reps: 12, repsMin: 8 })
  })

  it("matches an exercise by its variation name", () => {
    const { issues, workouts } = buildWorkoutsFromRows(
      [row({ exerciseName: "Squat", sourceRow: 1, variationName: "Goblet" })],
      EXERCISES,
      { duration: 1 },
    )

    expect(issues).toEqual([])
    expect(workouts[0].exercises[0].variationId).toBe("squat-goblet")
  })

  it("falls back to the default variation when the row names none", () => {
    const { workouts } = buildWorkoutsFromRows([row({ exerciseName: "Squat", sourceRow: 1 })], EXERCISES, {
      duration: 1,
    })

    expect(workouts[0].exercises[0].variationId).toBe("squat-barbell")
  })

  it("reports every bad row instead of stopping at the first", () => {
    const { issues, workouts } = buildWorkoutsFromRows(
      [
        row({ exerciseName: "Nonexistent Lift", sourceRow: 1 }),
        row({ exerciseName: "Another Missing Lift", sourceRow: 2 }),
        row({ reps: "", sourceRow: 3 }),
        row({ scheduledDay: undefined, sourceRow: 4 }),
        row({ sets: 0, sourceRow: 5 }),
        row({ sourceRow: 6 }),
      ],
      EXERCISES,
      { duration: 1 },
    )

    expect(issues.map((issue) => issue.sourceRow)).toEqual([1, 2, 3, 4, 5])
    // The one valid row still produces a workout; the caller decides whether the
    // issues block the import.
    expect(workouts).toHaveLength(1)
  })

  it("names the offending exercise in the issue message", () => {
    const { issues } = buildWorkoutsFromRows(
      [row({ exerciseName: "Zercher Squat", sourceRow: 7, variationName: "Barbell" })],
      EXERCISES,
      { duration: 1 },
    )

    expect(issues[0].message).toContain("Dòng 7")
    expect(issues[0].message).toContain("Zercher Squat / Barbell")
  })

  it("treats a missing duration as a single week", () => {
    const { workouts } = buildWorkoutsFromRows([row({ sourceRow: 1 })], EXERCISES)

    expect(workouts).toHaveLength(1)
    expect(workouts[0].weekIndex).toBe(0)
  })
})
