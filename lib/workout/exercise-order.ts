type SessionExercise = { sets: ReadonlyArray<{ completed?: boolean | null }> }

/** Done means every set is ticked; an exercise with no sets is still to do. */
export function isExerciseDone(exercise: SessionExercise) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.completed)
}

/**
 * The exercise to move on to after `fromIndex` is finished: the next unfinished
 * one in planned order, wrapping to any unfinished one skipped earlier. Null
 * when everything is done.
 */
export function nextIncompleteExercise(exercises: ReadonlyArray<SessionExercise>, fromIndex: number) {
  for (let step = 1; step < exercises.length; step++) {
    const index = (fromIndex + step) % exercises.length
    if (!isExerciseDone(exercises[index])) return index
  }
  return null
}
