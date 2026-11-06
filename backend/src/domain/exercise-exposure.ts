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
 * Rep cadence counts too, through the seconds a rep takes: the same load for
 * the same reps is a harder set when the tempo slows down, so the two cannot be
 * read as progress on one another.
 *
 * Pure: no Prisma, no I/O.
 */

import { repTutSeconds } from "./set-tempo"

type Prescription = {
  repMax: number | null
  repMin: number | null
  targetRir: number | null
  /** Rep cadence, e.g. "3-1-1-0". Null when none was prescribed. */
  tempo: string | null
}

type PrescribedSetLike = {
  intensityTag?: string | null
  targetReps?: number | null
  targetRepsMin?: number | null
  targetRir?: number | null
  tempo?: string | null
}

/** Which dimension stopped two prescriptions from being comparable. */
type PrescriptionMismatch = "reps" | "rir" | "tempo"

/** Rep-range midpoints further apart than this ask for a different stimulus (8–10 vs 15–20). */
const REP_MIDPOINT_TOLERANCE = 3
/** Target RIR further apart than this asks for a different effort. */
const RIR_TOLERANCE = 1
/**
 * Seconds per rep further apart than this ask for a different set. 10 reps at
 * 4-1-1-0 holds the muscle under tension for 60s where 2-0-1-0 holds it for 30,
 * so reading the second as progress on the first would add load to a set that
 * is already much harder.
 */
const REP_TUT_TOLERANCE_SECONDS = 1

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
    tempo: set && typeof set.tempo === "string" && set.tempo.length > 0 ? set.tempo : null,
  }
}

/**
 * Which dimension, if any, stops two prescriptions from asking the same thing.
 * `undefined` means they are comparable.
 *
 * An unknown rep target or target RIR is not held against the comparison — an
 * older log may simply never have recorded one. Tempo is the exception: a set
 * with no cadence was done at whatever pace the trainee chose, and one with a
 * cadence was not, so prescribing a tempo where there was none is a change of
 * prescription rather than a gap in what we know about it.
 */
function prescriptionMismatch(left: Prescription, right: Prescription): PrescriptionMismatch | undefined {
  const leftMid = midpoint(left)
  const rightMid = midpoint(right)
  if (leftMid != null && rightMid != null && Math.abs(leftMid - rightMid) > REP_MIDPOINT_TOLERANCE) return "reps"
  if (left.targetRir != null && right.targetRir != null && Math.abs(left.targetRir - right.targetRir) > RIR_TOLERANCE) return "rir"

  const leftTut = repTutSeconds(left.tempo)
  const rightTut = repTutSeconds(right.tempo)
  if (leftTut == null !== (rightTut == null)) return "tempo"
  if (leftTut != null && rightTut != null && Math.abs(leftTut - rightTut) > REP_TUT_TOLERANCE_SECONDS) return "tempo"

  return undefined
}

/** Whether two prescriptions ask for the same thing. */
function isComparablePrescription(left: Prescription, right: Prescription) {
  return prescriptionMismatch(left, right) === undefined
}

export {
  isComparablePrescription,
  prescriptionFromSets,
  prescriptionMismatch,
  REP_MIDPOINT_TOLERANCE,
  REP_TUT_TOLERANCE_SECONDS,
  RIR_TOLERANCE,
}
export type { PrescribedSetLike, Prescription, PrescriptionMismatch }
