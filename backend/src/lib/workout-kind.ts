export type InferredWorkoutKind = "push" | "pull" | "legs"

// Exercise.muscleGroup → split. Arms (biceps pull, triceps push), Core, Cardio
// and Other say nothing about the split, so they do not vote.
const GROUP_KIND: Record<string, InferredWorkoutKind> = {
  back: "pull",
  calves: "legs",
  chest: "push",
  legs: "legs",
  shoulders: "push",
}

/**
 * The push/pull/legs split of a workout that has no `kind`, from the muscle
 * groups of its exercises: the split with the most exercises wins. A tie or no
 * voting exercise gives null — better a neutral day on the calendar than a
 * guessed "push" for every unlabelled program.
 */
export function inferWorkoutKind(muscleGroups: ReadonlyArray<string | null | undefined>): InferredWorkoutKind | null {
  const votes: Record<InferredWorkoutKind, number> = { legs: 0, pull: 0, push: 0 }
  for (const group of muscleGroups) {
    const kind = group ? GROUP_KIND[group.trim().toLowerCase()] : undefined
    if (kind) votes[kind] += 1
  }

  const ranked = (Object.entries(votes) as Array<[InferredWorkoutKind, number]>).sort((left, right) => right[1] - left[1])
  const [top, runnerUp] = ranked
  if (top[1] === 0 || top[1] === runnerUp[1]) return null
  return top[0]
}
