import type { AppMessages } from "@/lib/i18n/messages"
import type { Workout } from "@/lib/types"

export type RoutineTag = "all" | "push" | "pull" | "legs" | "upper" | "lower" | "full"

export const TAG_DOT_COLOR: Record<Exclude<RoutineTag, "all">, string> = {
  full: "var(--ink-600)",
  legs: "var(--warning)",
  lower: "var(--chart-2)",
  pull: "var(--success)",
  push: "var(--primary)",
  upper: "var(--chart-4)",
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

/**
 * Three-tier fallback: the DB `kind` first, then the routine name, then the
 * muscle groups actually in the routine. `upper` and `lower` have no `WorkoutKind`
 * counterpart, so they can only ever be recovered from the last two tiers.
 */
export function inferRoutineTag(workout: Workout): Exclude<RoutineTag, "all"> {
  if (workout.kind === "push" || workout.kind === "pull" || workout.kind === "legs") {
    return workout.kind
  }

  if (workout.kind === "full_body") {
    return "full"
  }

  const name = normalizeText(workout.name)
  if (name.includes("upper")) return "upper"
  if (name.includes("lower")) return "lower"
  if (name.includes("push")) return "push"
  if (name.includes("pull")) return "pull"
  if (name.includes("leg")) return "legs"
  if (name.includes("full")) return "full"

  const groups = new Set(workout.exercises.map((exercise) => normalizeText(exercise.exercise.muscleGroup)))
  const hasUpper = ["chest", "back", "shoulders", "arms", "biceps", "triceps"].some((group) => groups.has(group))
  const hasLower = ["legs", "quads", "hamstrings", "glutes", "calves"].some((group) => groups.has(group))

  if (hasUpper && hasLower) return "full"
  if (hasUpper) return "upper"
  if (hasLower) return "lower"

  return "full"
}

export function getTagLabel(tag: RoutineTag, messages: AppMessages) {
  const labels: Record<RoutineTag, string> = {
    all: messages.workoutPage.all,
    full: messages.workoutPage.tagFull,
    legs: messages.workoutPage.tagLegs,
    lower: messages.workoutPage.tagLower,
    pull: messages.workoutPage.tagPull,
    push: messages.workoutPage.tagPush,
    upper: messages.workoutPage.tagUpper,
  }
  return labels[tag]
}

export function getTotalSets(workout: Workout) {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
}
