import { formatSetIntensityMethodCell, type SetIntensityAssignment } from "../domain/set-intensity-tag"
import type { PlanDay, PlanExercise } from "./google-program-plan.service"

/**
 * A program week as the rows a Google Sheet week tab holds.
 *
 * Pure, and kept apart from google-program-generate.service (which reaches
 * into the fitness-data service), so the log export can refresh a sheet's plan
 * from the app without importing that service back into itself.
 */

/** The shape the plan needs, structural so a test can hand it plain objects. */
export type SourceSet = {
  intensityTag: string | null
  rir: number | null
  setNumber: number
  targetReps: number
  targetRepsMin: number | null
  weight: number | null
}

export type SourceExercise = {
  notes: string | null
  order: number
  restTime: number | null
  sets: readonly SourceSet[]
  variation: {
    exercise: { muscleGroup: string; name: string }
    id: string
    isDefault: boolean
    name: string
  }
}

export type SourceWorkout = {
  exercises: readonly SourceExercise[]
  scheduledDate: Date | null
  scheduledDay: number | null
  weekIndex: number | null
}

/**
 * The name the `Exercise Table` tab lists this variation under.
 *
 * Must stay identical to the `name` `createGoogleProgramTemplate` builds its
 * reference rows from: the week grid resolves every other column by matching
 * this string, so a spelling that drifts from the reference tab leaves the
 * variation id blank and the sheet unable to export.
 */
export function variationDisplayName(variation: SourceExercise["variation"]) {
  return variation.isDefault ? variation.exercise.name : `${variation.exercise.name} (${variation.name})`
}

/**
 * The workouts that make up program week `weekIndex`, matching what the trainee
 * is shown: a week the coach did not author repeats the last authored week
 * before it.
 *
 * Workouts pinned to a calendar date are left out. They are one-off entries on
 * a trainee's schedule rather than part of a repeatable program, and the sheet
 * has nowhere to say "this row only applies to 12 March".
 */
export function selectProgramWeekWorkouts<T extends Pick<SourceWorkout, "scheduledDate" | "weekIndex">>(
  workouts: readonly T[],
  weekIndex: number,
): T[] {
  const recurring = workouts.filter((workout) => !workout.scheduledDate)
  if (recurring.length === 0) return []

  const authoredWeeks = [...new Set(recurring.map((workout) => Math.max(0, Math.round(workout.weekIndex ?? 0))))]
  const atOrBefore = authoredWeeks.filter((week) => week <= weekIndex)
  const effectiveWeek = atOrBefore.length > 0 ? Math.max(...atOrBefore) : Math.min(...authoredWeeks)

  return recurring.filter((workout) => Math.max(0, Math.round(workout.weekIndex ?? 0)) === effectiveWeek)
}

/**
 * One planned row per exercise, which is all the grid holds.
 *
 * Sets, reps, weight and RIR are read off the first set: the importer builds
 * every set of an exercise from that single row, so for a program that came
 * from a sheet the first set is the whole truth. A program built in the app can
 * prescribe a different weight per set, and that detail does not survive the
 * trip — the row records the opening set, not the ramp.
 */
function toPlanExercise(exercise: SourceExercise): PlanExercise {
  const [first] = exercise.sets
  const assignments = exercise.sets.flatMap((set) =>
    set.intensityTag ? [{ setNumber: set.setNumber, tag: set.intensityTag } as SetIntensityAssignment] : [],
  )

  return {
    displayName: variationDisplayName(exercise.variation),
    method: formatSetIntensityMethodCell(assignments, exercise.sets.length) || undefined,
    muscleGroup: exercise.variation.exercise.muscleGroup,
    notes: exercise.notes ?? undefined,
    reps: first ? (first.targetRepsMin ? `${first.targetRepsMin}-${first.targetReps}` : String(first.targetReps)) : undefined,
    restTime: exercise.restTime ?? undefined,
    rir: first?.rir ?? undefined,
    sets: exercise.sets.length || undefined,
    variationId: exercise.variation.id,
    variationName: exercise.variation.name,
    weight: first?.weight ?? undefined,
  }
}

/** Groups a week's workouts onto the days the grid lays out, in exercise order. */
export function toPlanDays(workouts: readonly SourceWorkout[]): PlanDay[] {
  const byDay = new Map<number, PlanExercise[]>()

  for (const workout of workouts) {
    if (!Number.isInteger(workout.scheduledDay)) continue

    const day = workout.scheduledDay!
    const exercises = [...workout.exercises].sort((left, right) => left.order - right.order).map(toPlanExercise)
    byDay.set(day, [...(byDay.get(day) ?? []), ...exercises])
  }

  return [...byDay.entries()]
    .sort(([left], [right]) => left - right)
    .map(([day, exercises]) => ({ day, exercises }))
}
