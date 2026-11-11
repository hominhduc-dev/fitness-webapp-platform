/**
 * Per-set targets: the reps, weight and RIR of a set that differs from its
 * exercise. The editor offers one such shape, the back-off sets after a top
 * set ("6-8 @65 kg, then 5-10 @50 kg"), as a second row of fields.
 *
 * The backend mirror lives in `backend/src/domain/set-target.ts`.
 */
import { hasTopBackoffScheme, type SetIntensityAssignment } from "@/lib/workout/intensity-tag"
import { formatRepTarget, parseRepTargetText } from "@/lib/workout-reps"

export type SetTargetAssignment = {
  setNumber: number
  reps: number
  repsMin?: number
  rir?: number
  weight?: number
}

/** The back-off sets' fields as the editor holds them: text, like the exercise's own. */
export type BackOffTargetDraft = {
  reps: string
  rir: string
  weight: string
}

type PlannedSet = {
  rir?: number | null
  setNumber: number
  targetReps: number
  targetRepsMin?: number | null
  weight?: number | null
}

function sameTarget(left: PlannedSet, right: PlannedSet) {
  return (
    left.targetReps === right.targetReps &&
    (left.targetRepsMin ?? null) === (right.targetRepsMin ?? null) &&
    (left.weight ?? null) === (right.weight ?? null) &&
    (left.rir ?? null) === (right.rir ?? null)
  )
}

/**
 * The back-off row of a saved top set + back-off exercise, or undefined when
 * the exercise has no such scheme or its back-off sets match the top set (the
 * row then follows the top set's fields).
 */
export function readBackOffTarget(
  sets: readonly PlannedSet[],
  assignments: readonly SetIntensityAssignment[] | undefined,
): BackOffTargetDraft | undefined {
  const ordered = sets.slice().sort((left, right) => left.setNumber - right.setNumber)
  const [top, backOff] = ordered
  if (!top || !backOff || !hasTopBackoffScheme(assignments, ordered.length)) return undefined
  if (sameTarget(top, backOff)) return undefined

  return {
    reps: formatRepTarget({ reps: backOff.targetReps, repsMin: backOff.targetRepsMin ?? undefined }),
    rir: backOff.rir != null ? String(backOff.rir) : "",
    weight: backOff.weight != null ? String(backOff.weight) : "",
  }
}

export type BackOffSetTargetsResult =
  | { error?: undefined; setTargets: SetTargetAssignment[] | undefined }
  | { error: "reps"; setTargets?: undefined }

/**
 * The `setTargets` an exercise sends for its back-off row: one per set after
 * the first, when the exercise runs the top set + back-off scheme. Without the
 * scheme, a back-off row left in the draft is not sent, so what is saved is
 * what the card shows. A blank weight or RIR is left out and the set keeps the
 * exercise's.
 */
export function buildBackOffSetTargets(
  backOff: BackOffTargetDraft | undefined,
  setCount: number,
  assignments: readonly SetIntensityAssignment[] | undefined,
): BackOffSetTargetsResult {
  if (!backOff || setCount < 2 || !hasTopBackoffScheme(assignments, setCount)) return { setTargets: undefined }

  const repTarget = parseRepTargetText(backOff.reps)
  if (!repTarget) return { error: "reps" }

  const weight = Number(backOff.weight)
  const rir = Number(backOff.rir)
  const shared = {
    reps: repTarget.reps,
    ...(repTarget.repsMin != null ? { repsMin: repTarget.repsMin } : {}),
    ...(backOff.rir.trim() && Number.isFinite(rir) ? { rir: Math.min(10, Math.max(0, Math.round(rir))) } : {}),
    ...(backOff.weight.trim() && Number.isFinite(weight) ? { weight: Math.max(0, weight) } : {}),
  }

  return {
    setTargets: Array.from({ length: setCount - 1 }, (_value, index) => ({ setNumber: index + 2, ...shared })),
  }
}

/**
 * Every set that differs from set 1, as `setTargets`: copies a saved exercise
 * whole, whatever shape its sets have.
 */
export function readSetTargets(sets: readonly PlannedSet[]): SetTargetAssignment[] | undefined {
  const ordered = sets.slice().sort((left, right) => left.setNumber - right.setNumber)
  const [first] = ordered
  if (!first) return undefined

  const targets = ordered.slice(1).flatMap((set) =>
    sameTarget(first, set)
      ? []
      : [{
          reps: set.targetReps,
          setNumber: set.setNumber,
          ...(set.targetRepsMin != null ? { repsMin: set.targetRepsMin } : {}),
          ...(set.rir != null ? { rir: set.rir } : {}),
          ...(set.weight != null ? { weight: set.weight } : {}),
        }],
  )

  return targets.length ? targets : undefined
}
