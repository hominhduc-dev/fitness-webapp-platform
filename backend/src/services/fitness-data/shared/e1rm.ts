/**
 * Estimated One-Rep Max (e1RM) utilities.
 *
 * Uses the **Epley formula**: `e1RM = weight × (1 + reps / 30)`.
 * When RIR (Reps In Reserve) is provided the effective reps become
 * `actualReps + rir` so the estimate reflects true capacity rather than
 * the stopped set.
 *
 * All functions are pure — no I/O, no Prisma, no auth.
 */

/**
 * Calculate estimated 1-rep max from a single set.
 *
 * @returns e1RM in the same unit as `weight`, or `null` when the inputs
 *          are not meaningful (zero/negative weight or reps).
 */
function calculateE1RM(
  weight: number,
  reps: number,
  rir?: number | null,
): number | null {
  if (weight <= 0 || reps <= 0) return null

  // When RIR is available, add it to get "true" reps the lifter could have done
  const effectiveReps = rir != null && rir > 0 ? reps + rir : reps

  // 1-rep set → e1RM equals the weight itself
  if (effectiveReps === 1) return weight

  // Epley formula
  return Math.round(weight * (1 + effectiveReps / 30) * 10) / 10
}

/**
 * Snapshot set shape extracted from `WorkoutLog.exerciseSnapshot` JSON.
 * Kept minimal — only the fields needed for e1RM calculation.
 */
interface SnapshotSetForE1RM {
  actualReps?: number | null
  completed?: boolean
  rir?: number | null
  targetReps?: number | null
  weight?: number | null
}

/**
 * Find the highest e1RM across a list of completed sets.
 *
 * @returns The best e1RM along with the underlying weight and reps that
 *          produced it, or `null` when no valid set exists.
 */
function getBestE1RMFromSets(
  sets: SnapshotSetForE1RM[],
): { e1rm: number; reps: number; weight: number } | null {
  let best: { e1rm: number; reps: number; weight: number } | null = null

  for (const set of sets) {
    if (!set.completed || !set.weight || set.weight <= 0) continue

    const reps = set.actualReps ?? set.targetReps ?? 0
    if (reps <= 0) continue

    const e1rm = calculateE1RM(set.weight, reps, set.rir)
    if (e1rm == null) continue

    if (!best || e1rm > best.e1rm) {
      best = { e1rm, reps, weight: set.weight }
    }
  }

  return best
}

export { calculateE1RM, getBestE1RMFromSets }
export type { SnapshotSetForE1RM }
