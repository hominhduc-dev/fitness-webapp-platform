import type { CreateCoachProgramInput, ExerciseVariationOption } from "@/lib/fitness/types"
import { parseSetIntensityMethodCell } from "@/lib/workout/intensity-tag"
import { parseRepTargetText } from "@/lib/workout-reps"

/**
 * Source-agnostic middle step of the coach program importers.
 *
 * Both importers narrow their input to `ProgramImportRow[]` and hand it here:
 * the Excel parser after reading the sheet, the Notion importer after the backend
 * normalises the pages. Everything downstream — resolving exercise names to
 * variation ids, grouping rows into workouts, expanding a template week — happens
 * once, so a coach gets identical behaviour and identical error wording from
 * either source.
 */

/** One exercise inside one workout, already split out of whatever the source was. */
type ProgramImportRow = {
  notes?: string
  exerciseName: string
  /** Raw `Method` cell, e.g. "mrm", "all:drop", "1:warmup,3:mrm", "-, -, rp". */
  method?: string
  /** Position inside the workout. Falls back to the order rows arrive in. */
  order?: number
  /** Raw text so ranges such as "8-12" survive; parsed with the shared helper. */
  reps: string
  rir?: number
  restTime?: number
  /** 1-7, which session of the week. */
  scheduledDay?: number
  sets?: number
  /** Row number as the coach sees it in the source, used verbatim in errors. */
  sourceRow: number
  /** Set when the source names a variation id outright; skips name matching. */
  variationId?: string
  variationName: string
  /** 1-based week number from the source; absent when one template week repeats. */
  week?: number
  weight?: number
  workoutName: string
}

type ProgramImportIssue = {
  message: string
  sourceRow: number
}

type BuildWorkoutsResult = {
  /** Every problem found, never truncated: the coach fixes the source in one pass. */
  issues: ProgramImportIssue[]
  workouts: CreateCoachProgramInput["workouts"]
}

type BuildWorkoutsOptions = {
  /**
   * Weeks the program runs for. Only used when no row carries a `week`, in which
   * case the rows are treated as one template week and repeated this many times.
   */
  duration?: number
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function buildVariationLookup(exercises: ExerciseVariationOption[]) {
  const byExerciseAndVariation = new Map<string, ExerciseVariationOption>()
  const byExerciseName = new Map<string, ExerciseVariationOption[]>()
  const byId = new Map<string, ExerciseVariationOption>()

  exercises.forEach((exercise) => {
    const exerciseNameKey = normalizeLookup(exercise.exerciseName)
    const variationKey = `${exerciseNameKey}::${normalizeLookup(exercise.variationName)}`

    byId.set(exercise.id, exercise)
    byExerciseAndVariation.set(variationKey, exercise)
    byExerciseName.set(exerciseNameKey, [...(byExerciseName.get(exerciseNameKey) ?? []), exercise])
  })

  return {
    byExerciseAndVariation,
    byExerciseName,
    byId,
  }
}

/**
 * Matches a row to a variation, most specific signal first: an explicit id, then
 * the exercise and variation pair, then the exercise name alone when it is
 * unambiguous or has a default variation.
 */
function resolveVariation(
  lookup: ReturnType<typeof buildVariationLookup>,
  row: {
    exerciseName: string
    variationId: string
    variationName: string
  },
) {
  if (row.variationId) {
    return lookup.byId.get(row.variationId)
  }

  if (row.exerciseName && row.variationName) {
    return lookup.byExerciseAndVariation.get(
      `${normalizeLookup(row.exerciseName)}::${normalizeLookup(row.variationName)}`,
    )
  }

  if (row.exerciseName) {
    const matches = lookup.byExerciseName.get(normalizeLookup(row.exerciseName)) ?? []

    if (matches.length === 1) {
      return matches[0]
    }

    const defaultMatch = matches.find((exercise) => exercise.isDefault)

    if (defaultMatch) {
      return defaultMatch
    }
  }

  return undefined
}

function parsePositiveInteger(value: unknown) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return undefined
  }

  const normalizedValue = Math.round(parsedValue)

  return normalizedValue > 0 ? normalizedValue : undefined
}

/**
 * Builds the workout tree `createCoachProgram` expects.
 *
 * Rows that fail validation are collected rather than thrown on, so one typo does
 * not hide the other nineteen. The caller decides whether a non-empty `issues`
 * list blocks the import.
 */
function buildWorkoutsFromRows(
  rows: ProgramImportRow[],
  exercises: ExerciseVariationOption[],
  options: BuildWorkoutsOptions = {},
): BuildWorkoutsResult {
  const lookup = buildVariationLookup(exercises)
  const issues: ProgramImportIssue[] = []

  const usesExplicitWeeks = rows.some((row) => row.week !== undefined)
  const repeatWeeks = usesExplicitWeeks ? 1 : Math.max(1, Math.round(options.duration ?? 1))

  type GroupedWorkout = CreateCoachProgramInput["workouts"][number]
  const grouped = new Map<string, GroupedWorkout>()

  rows.forEach((row) => {
    const sets = parsePositiveInteger(row.sets)
    const repTarget = parseRepTargetText(row.reps)

    if (!row.workoutName) {
      issues.push({ message: `Dòng ${row.sourceRow}: thiếu tên buổi tập.`, sourceRow: row.sourceRow })
      return
    }

    if (row.scheduledDay == null) {
      issues.push({ message: `Dòng ${row.sourceRow}: thiếu hoặc sai cột Day, phải là 1 đến 7.`, sourceRow: row.sourceRow })
      return
    }

    if (!sets || !Number.isInteger(row.sets)) {
      issues.push({ message: `Dòng ${row.sourceRow}: Sets phải là số nguyên dương.`, sourceRow: row.sourceRow })
      return
    }

    if ([row.weight, row.rir, row.restTime].some((value) => value != null && (!Number.isFinite(value) || value < 0)) ||
      [row.rir, row.restTime].some((value) => value != null && !Number.isInteger(value))) {
      issues.push({ message: `Dòng ${row.sourceRow}: Weight, RIR hoặc Rest không hợp lệ.`, sourceRow: row.sourceRow })
      return
    }

    if (!repTarget) {
      issues.push({
        message: `Dòng ${row.sourceRow}: Reps phải là số nguyên dương hoặc khoảng như 8-12.`,
        sourceRow: row.sourceRow,
      })
      return
    }

    const parsedMethod = parseSetIntensityMethodCell(row.method, sets)

    if (!parsedMethod.assignments) {
      issues.push({ message: `Dòng ${row.sourceRow}: ${parsedMethod.error}`, sourceRow: row.sourceRow })
      return
    }

    if (!row.variationId && !row.exerciseName) {
      issues.push({ message: `Dòng ${row.sourceRow}: cần tên Exercise hoặc variation id.`, sourceRow: row.sourceRow })
      return
    }

    const variation = resolveVariation(lookup, {
      exerciseName: row.exerciseName,
      variationId: row.variationId ?? "",
      variationName: row.variationName,
    })

    if (!variation) {
      const label = row.variationId || `${row.exerciseName} / ${row.variationName || "Default"}`

      issues.push({
        message: `Dòng ${row.sourceRow}: không tìm thấy bài tập '${label}' trong thư viện.`,
        sourceRow: row.sourceRow,
      })
      return
    }

    const exercise = {
      notes: row.notes,
      reps: repTarget.reps,
      repsMin: repTarget.repsMin,
      rir: row.rir,
      restTime: row.restTime,
      setIntensityTags: parsedMethod.assignments.length ? parsedMethod.assignments : undefined,
      sets,
      variationId: variation.id,
      weight: typeof row.weight === "number" && Number.isFinite(row.weight) ? Math.max(0, row.weight) : undefined,
    }

    for (let repeat = 0; repeat < repeatWeeks; repeat += 1) {
      const weekIndex = row.week == null ? repeat : Math.max(0, row.week - 1)
      const key = `${weekIndex}::${row.workoutName}::${row.scheduledDay}`
      const workout = grouped.get(key) ?? {
        exercises: [],
        name: row.workoutName,
        scheduledDay: row.scheduledDay,
        weekIndex,
      }

      workout.exercises.push({
        ...exercise,
        setIntensityTags: exercise.setIntensityTags?.map((assignment) => ({ ...assignment })),
      })
      grouped.set(key, workout)
    }
  })

  // Grouping walks rows first and weeks second, which interleaves the weeks. The
  // review screen lists workouts in this order, so sort it back into the order a
  // coach reads a program: week 1 day 1, week 1 day 2, week 2 day 1.
  const workouts = Array.from(grouped.values()).sort(
    (left, right) =>
      (left.weekIndex ?? 0) - (right.weekIndex ?? 0) || (left.scheduledDay ?? 0) - (right.scheduledDay ?? 0),
  )

  return {
    issues,
    workouts,
  }
}

export { buildVariationLookup, buildWorkoutsFromRows, normalizeLookup, parsePositiveInteger, resolveVariation }
export type { BuildWorkoutsResult, ProgramImportIssue, ProgramImportRow }
