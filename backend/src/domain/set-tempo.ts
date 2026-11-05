/**
 * Rep cadence a coach prescribes for a set: "3-1-1-0" is three seconds down,
 * one paused, one up, none at the top. Every rep of the set holds it — that is
 * what makes it a cadence rather than a cue — but the sets of one exercise may
 * each carry their own, which is how a heavy top set at 2-0-1-0 and a slower
 * back-off at 4-1-1-0 are written down.
 *
 * A set with no tempo is simply unprescribed, so everything here treats an
 * unreadable value as `undefined` rather than an error: the trainee can still
 * log the set.
 *
 * The frontend mirror lives in `lib/workout/set-tempo.ts`; the backend cannot
 * import it because its `rootDir` is `src`. Keep the grammar in step across
 * both, since a coach's sheet is parsed on whichever side reads it first.
 */

type SetTempoAssignment = {
  setNumber: number
  tempo: string
}

/** Down, pause at the bottom, up, pause at the top. */
const TEMPO_PHASE_COUNT = 4
/** Longest a single phase may be, in seconds. Beyond this it is a typo, not a prescription. */
const MAX_TEMPO_PHASE_SECONDS = 60
/** The concentric is the one phase written as a letter: "as fast as you can". */
const EXPLOSIVE_PHASE = "X"

/** Values that explicitly mean "no tempo here", as opposed to a typo. */
const EMPTY_TEMPO_TOKENS = new Set(["", "-", "--", "—", "none", "no", "normal", "n/a", "na"])

function normalizeTempoToken(value: string) {
  return value.trim().toLowerCase()
}

/**
 * Reads one cadence. Accepts the spellings coaches use — `3110`, `3-1-1-0`,
 * `3/1/1/0`, `3 1 1 0`, `30X0` — and returns the canonical hyphenated form.
 *
 * The compact `3110` form is only read when every phase is a single character,
 * because `3-10-1-0` and `3101-0` cannot both be meant by `31010`.
 */
function parseSetTempo(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined

  const text = String(value).trim()
  if (!text || EMPTY_TEMPO_TOKENS.has(normalizeTempoToken(text))) return undefined

  const separated = text.split(/[\s\-–—/.:]+/).filter((phase) => phase.length > 0)
  const phases = separated.length === 1 && /^[0-9xX]{4}$/.test(separated[0])
    ? separated[0].split("")
    : separated

  if (phases.length !== TEMPO_PHASE_COUNT) return undefined

  const canonical: string[] = []
  for (const [index, phase] of phases.entries()) {
    // Only the concentric is ever explosive; "X" anywhere else is a typo.
    if (phase.toUpperCase() === EXPLOSIVE_PHASE) {
      if (index !== 2) return undefined
      canonical.push(EXPLOSIVE_PHASE)
      continue
    }
    if (!/^\d{1,2}$/.test(phase)) return undefined
    const seconds = Number(phase)
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_TEMPO_PHASE_SECONDS) return undefined
    canonical.push(String(seconds))
  }

  return canonical.join("-")
}

function isSetTempo(value: unknown): value is string {
  return parseSetTempo(value) !== undefined
}

/**
 * Drops assignments outside `1..setCount`, keeps the last tempo written for a
 * set and returns them in set order — the same contract the intensity tags use,
 * for the same reason: a coach's set count and their list can disagree.
 */
function normalizeSetTempoAssignments(
  assignments: readonly SetTempoAssignment[] | undefined,
  setCount: number,
): SetTempoAssignment[] {
  if (!assignments?.length) return []

  const bySetNumber = new Map<number, string>()

  assignments.forEach((assignment) => {
    const setNumber = Number(assignment?.setNumber)
    if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > setCount) return

    const tempo = parseSetTempo(assignment?.tempo)
    if (!tempo) return

    bySetNumber.set(setNumber, tempo)
  })

  return Array.from(bySetNumber.entries())
    .sort(([left], [right]) => left - right)
    .map(([setNumber, tempo]) => ({ setNumber, tempo }))
}

/** Lookup keyed by set number, for building `ExerciseSet` rows. */
function buildSetTempoMap(
  assignments: readonly SetTempoAssignment[] | undefined,
  setCount: number,
): Map<number, string> {
  return new Map(normalizeSetTempoAssignments(assignments, setCount).map(({ setNumber, tempo }) => [setNumber, tempo]))
}

/**
 * Writes assignments back into a `Tempo` cell, the inverse of
 * `parseSetTempoCell`. Emits `all:3-1-1-0` when every set shares a cadence and
 * `1:2-0-1-0,3:4-1-1-0` otherwise, so the cell always says which set it means.
 */
function formatSetTempoCell(
  assignments: readonly SetTempoAssignment[] | undefined,
  setCount: number,
): string {
  const normalized = normalizeSetTempoAssignments(assignments, setCount)
  if (normalized.length === 0) return ""

  const [{ tempo: firstTempo }] = normalized
  if (normalized.length === setCount && normalized.every((assignment) => assignment.tempo === firstTempo)) {
    return `all:${firstTempo}`
  }

  return normalized.map(({ setNumber, tempo }) => `${setNumber}:${tempo}`).join(",")
}

type ParsedSetTempoCell =
  | { assignments: SetTempoAssignment[]; error?: undefined }
  | { assignments?: undefined; error: string }

/**
 * Reads a spreadsheet `Tempo` cell against an exercise of `setCount` sets.
 *
 * - blank, `-`, `normal` → no tempo
 * - `set:tempo` tokens (`1:2-0-1-0,3:4-1-1-0`), or `all:3-1-1-0` → those sets
 * - several bare cadences (`2-0-1-0, 4-1-1-0`) → one per set, in order
 * - one bare cadence (`3-1-1-0`) → every set, since a lone cadence is how a
 *   coach writes "this exercise is tempo work"
 *
 * A typo is an error rather than a silent skip: a coach who wrote `3-1-1` meant
 * something, and dropping it quietly would ship a program missing the cadence.
 */
function parseSetTempoCell(raw: unknown, setCount: number): ParsedSetTempoCell {
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim()

  if (!text || EMPTY_TEMPO_TOKENS.has(normalizeTempoToken(text))) {
    return { assignments: [] }
  }

  if (!Number.isInteger(setCount) || setCount < 1) {
    return { error: "Tempo cần số Sets hợp lệ trước." }
  }

  const tokens = text.split(",").map((token) => token.trim())

  // A cadence may itself be hyphenated, so a token only targets a set when its
  // colon comes before any digit run — "1:2-0-1-0" targets, "2-0-1-0" does not.
  if (tokens.every((token) => token.includes(":"))) {
    const bySetNumber = new Map<number, string>()

    for (const token of tokens) {
      const separatorIndex = token.indexOf(":")
      const key = normalizeTempoToken(token.slice(0, separatorIndex))
      const tempoText = token.slice(separatorIndex + 1).trim()
      const tempo = parseSetTempo(tempoText)

      if (!tempo) {
        return { error: `Tempo '${tempoText || "(trống)"}' không hợp lệ.` }
      }

      if (key === "all") {
        for (let setNumber = 1; setNumber <= setCount; setNumber += 1) {
          bySetNumber.set(setNumber, tempo)
        }
        continue
      }

      const setNumber = Number(key)

      if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > setCount) {
        return { error: `Tempo chỉ định set ${key || "(trống)"} ngoài phạm vi 1-${setCount}.` }
      }

      bySetNumber.set(setNumber, tempo)
    }

    return {
      assignments: Array.from(bySetNumber.entries())
        .sort(([left], [right]) => left - right)
        .map(([setNumber, tempo]) => ({ setNumber, tempo })),
    }
  }

  if (tokens.length > 1) {
    if (tokens.length > setCount) {
      return { error: `Tempo có ${tokens.length} giá trị nhưng bài tập chỉ có ${setCount} set.` }
    }

    const assignments: SetTempoAssignment[] = []

    for (const [index, token] of tokens.entries()) {
      if (EMPTY_TEMPO_TOKENS.has(normalizeTempoToken(token))) continue

      const tempo = parseSetTempo(token)
      if (!tempo) {
        return { error: `Tempo '${token}' không hợp lệ.` }
      }

      assignments.push({ setNumber: index + 1, tempo })
    }

    return { assignments }
  }

  const tempo = parseSetTempo(text)

  if (!tempo) {
    return { error: `Tempo '${text}' không hợp lệ.` }
  }

  // Unlike a method, a lone cadence applies to the whole exercise: tempo is the
  // way the reps are done, not a finisher attached to one set.
  return {
    assignments: Array.from({ length: setCount }, (_, index) => ({ setNumber: index + 1, tempo })),
  }
}

export {
  EXPLOSIVE_PHASE,
  MAX_TEMPO_PHASE_SECONDS,
  TEMPO_PHASE_COUNT,
  buildSetTempoMap,
  formatSetTempoCell,
  isSetTempo,
  normalizeSetTempoAssignments,
  parseSetTempo,
  parseSetTempoCell,
}
export type { ParsedSetTempoCell, SetTempoAssignment }
