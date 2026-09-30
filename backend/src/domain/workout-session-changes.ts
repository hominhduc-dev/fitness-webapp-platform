/**
 * What a finished session changed against the workout it was trained from.
 *
 * Swaps and exercise notes stay on the trainee's device while they train and
 * reach the server only inside the finished log. Comparing each logged exercise
 * with the prescribed one tells the two apart from what the plan already said.
 */

type LoggedExercise = {
  exercise?: { name?: unknown }
  id: string
  notes?: unknown
  variation?: { displayName?: unknown; id?: unknown }
}

type PrescribedExercise = {
  notes?: string
  variation: { id: string }
}

export type SessionSwap = {
  newVariationId: string
  workoutExerciseId: string
}

export type SessionExerciseNote = {
  exerciseName: string
  note: string
}

const MAX_NOTES = 20
const MAX_NOTE_LENGTH = 500

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function collectSessionChanges(
  logged: readonly LoggedExercise[],
  prescribedById: ReadonlyMap<string, PrescribedExercise>,
) {
  const swaps: SessionSwap[] = []
  const notes: SessionExerciseNote[] = []

  for (const entry of logged) {
    const prescribed = prescribedById.get(entry.id)
    const variationId = readText(entry.variation?.id)
    // Exercises added mid-session have no slot to swap.
    if (prescribed && variationId && variationId !== prescribed.variation.id) {
      swaps.push({ newVariationId: variationId, workoutExerciseId: entry.id })
    }

    // The session opens with the coach's note in the same field, so only a
    // changed note is the trainee's.
    const note = readText(entry.notes)
    if (note && note !== readText(prescribed?.notes) && notes.length < MAX_NOTES) {
      notes.push({
        exerciseName: readText(entry.variation?.displayName) || readText(entry.exercise?.name) || "?",
        note: note.slice(0, MAX_NOTE_LENGTH),
      })
    }
  }

  return { notes, swaps }
}
