/**
 * Per-set targets: the reps, weight and RIR one set of an exercise is
 * programmed for when it differs from the exercise's own.
 *
 * An exercise carries one target that every set takes. A top set + back-off
 * exercise is the common case where sets differ ("6-8 @65 kg, then 5-10 @50
 * kg"), so a set may override that target. Sets without an override keep the
 * exercise's. The frontend mirror lives in `lib/workout/per-set-target.ts`.
 */

export type SetTargetAssignment = {
  setNumber: number
  reps: number
  repsMin?: number
  rir?: number
  weight?: number
}

/**
 * The overrides of an exercise with `setCount` sets, by set number. Overrides
 * for sets the exercise no longer has are dropped: a coach who removes a set
 * leaves its override behind, and that is not an error. A later entry for the
 * same set wins.
 */
export function buildSetTargetMap(targets: readonly SetTargetAssignment[] | undefined, setCount: number) {
  const bySetNumber = new Map<number, SetTargetAssignment>()
  const maxSet = Math.max(0, Math.floor(setCount))

  for (const target of targets ?? []) {
    if (!Number.isInteger(target.setNumber) || target.setNumber < 1 || target.setNumber > maxSet) continue
    bySetNumber.set(target.setNumber, target)
  }

  return bySetNumber
}
