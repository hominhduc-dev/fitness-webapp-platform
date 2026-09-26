import { isExerciseDone, nextIncompleteExercise } from "@/lib/workout/exercise-order"

type SessionExercise = Parameters<typeof isExerciseDone>[0]

export type PrimaryNavAction =
  | { kind: "completeSet"; setIndex: number }
  | { kind: "next"; index: number }
  | { kind: "unfinished"; index: number }
  | { kind: "finish" }
  | { kind: "finishLocked" }

/**
 * The set the trainee is on in an exercise: the first one not yet ticked.
 * Null when every set is done (or there are none).
 */
export function activeSetIndex(exercise: SessionExercise | null | undefined) {
  if (!exercise) return null
  const index = exercise.sets.findIndex((set) => !set.completed)
  return index < 0 ? null : index
}

/**
 * What the pinned bar's main button does from `currentIndex`. While the
 * exercise on screen has a set left, it logs that set. Once the exercise is
 * done it steps to the next exercise in planned order, and from the last one
 * back to one still to do. With everything logged it finishes the session;
 * when the exercise on screen has no sets and is the only one left, finishing
 * shows but stays locked — the bar never finishes while work is left.
 */
export function primaryNavAction(exercises: ReadonlyArray<SessionExercise>, currentIndex: number): PrimaryNavAction {
  const setIndex = activeSetIndex(exercises[currentIndex])
  if (setIndex != null) return { kind: "completeSet", setIndex }
  if (exercises.length === 0 || exercises.every(isExerciseDone)) return { kind: "finish" }
  if (currentIndex < exercises.length - 1) return { kind: "next", index: currentIndex + 1 }
  const index = nextIncompleteExercise(exercises, currentIndex)
  if (index == null) return { kind: "finishLocked" }
  return { kind: "unfinished", index }
}
