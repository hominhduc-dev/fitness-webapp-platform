/**
 * When two sessions of the same exercise can be compared.
 *
 * The variation says what was trained; the prescription — rep range and target
 * effort — says what the session asked of it. Performance is only compared
 * between sessions that share both: 80 kg × 8 in a 6–8 block and 60 kg × 15 in
 * a 15–20 block are not a regression, and a machine press done because the
 * bench was taken says nothing about the bench.
 *
 * Set count is left out on purpose: a coach adding a set changes the volume,
 * not what each set asks for.
 *
 * Pure: no Prisma, no I/O.
 */

type Prescription = {
  repMax: number | null
  repMin: number | null
  targetRir: number | null
}

type PrescribedSetLike = {
  intensityTag?: string | null
  targetReps?: number | null
  targetRepsMin?: number | null
  targetRir?: number | null
}

/** Rep-range midpoints further apart than this ask for a different stimulus (8–10 vs 15–20). */
const REP_MIDPOINT_TOLERANCE = 3
/** Target RIR further apart than this asks for a different effort. */
const RIR_TOLERANCE = 1

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

function midpoint(prescription: Prescription) {
  if (prescription.repMax == null) return null
  return ((prescription.repMin ?? prescription.repMax) + prescription.repMax) / 2
}

/** The prescription of an exercise, read from its first working set that has a rep target. */
function prescriptionFromSets(sets: readonly PrescribedSetLike[]): Prescription {
  const set = sets.find((entry) => entry.intensityTag !== "warmup" && finite(entry.targetReps) && entry.targetReps > 0)
  return {
    repMax: set && finite(set.targetReps) ? set.targetReps : null,
    repMin: set && finite(set.targetRepsMin) && set.targetRepsMin > 0 ? set.targetRepsMin : null,
    targetRir: set && finite(set.targetRir) ? set.targetRir : null,
  }
}

/**
 * Whether two prescriptions ask for the same thing. A side that is unknown —
 * an older log that never recorded its target RIR, say — is not held against
 * the comparison.
 */
function isComparablePrescription(left: Prescription, right: Prescription) {
  const leftMid = midpoint(left)
  const rightMid = midpoint(right)
  if (leftMid != null && rightMid != null && Math.abs(leftMid - rightMid) > REP_MIDPOINT_TOLERANCE) return false
  if (left.targetRir != null && right.targetRir != null && Math.abs(left.targetRir - right.targetRir) > RIR_TOLERANCE) return false
  return true
}

export { isComparablePrescription, prescriptionFromSets, REP_MIDPOINT_TOLERANCE, RIR_TOLERANCE }
export type { PrescribedSetLike, Prescription }
