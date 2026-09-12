/**
 * Per-set training method a coach prescribes: "do set 3 as a myo-rep match".
 *
 * A set with no tag is a normal straight set, so nothing here ever invents one.
 * The backend mirror lives in `backend/src/domain/set-intensity-tag.ts` and owns
 * the Prisma enum; the two files must keep the same tags, aliases and method
 * grammar because a coach's sheet is parsed on whichever side reads it first.
 */

export type IntensityTag = "mrm" | "drop_set" | "rest_pause" | "cluster" | "failure" | "warmup"

export type SetIntensityAssignment = {
  setNumber: number
  tag: IntensityTag
}

export const INTENSITY_TAGS = [
  "mrm",
  "drop_set",
  "rest_pause",
  "cluster",
  "failure",
  "warmup",
] as const satisfies readonly IntensityTag[]

/** The short badge the trainee sees in the set row. Keep them under five glyphs. */
export const INTENSITY_TAG_BADGES: Record<IntensityTag, string> = {
  cluster: "CLS",
  drop_set: "DROP",
  failure: "FAIL",
  mrm: "MRM",
  rest_pause: "RP",
  warmup: "WU",
}

/**
 * The spelling each tag gets in a sheet's Method dropdown. The canonical enum
 * names read badly in a picker, and `drop` / `rp` are what coaches write anyway;
 * every one of these resolves through the aliases above.
 */
export const INTENSITY_METHOD_SHEET_TOKENS: Record<IntensityTag, string> = {
  cluster: "cluster",
  drop_set: "drop",
  failure: "failure",
  mrm: "mrm",
  rest_pause: "rp",
  warmup: "warmup",
}

/**
 * What the Method dropdown offers: clear it, apply a method to the last set, or
 * apply it to every set.
 *
 * The dropdown is deliberately not strict. Per-set targeting like
 * `1:warmup,3:mrm` stays typeable, because a list long enough to enumerate it
 * would be unusable. No entry may contain a comma — Excel separates inline list
 * items with one.
 */
export const INTENSITY_METHOD_CHOICES: string[] = [
  "-",
  ...INTENSITY_TAGS.map((tag) => INTENSITY_METHOD_SHEET_TOKENS[tag]),
  ...INTENSITY_TAGS.map((tag) => `all:${INTENSITY_METHOD_SHEET_TOKENS[tag]}`),
]

/** What a coach may type in a sheet's `Method` cell. */
const INTENSITY_TAG_ALIASES: Array<[IntensityTag, string[]]> = [
  ["mrm", ["mrm", "myo match", "myo-rep match", "myo rep match", "myomatch"]],
  ["drop_set", ["drop", "drop set", "dropset", "drop_set"]],
  ["rest_pause", ["rp", "rest pause", "rest-pause", "rest_pause", "restpause"]],
  ["cluster", ["cluster", "cls"]],
  ["failure", ["failure", "fail", "to failure"]],
  ["warmup", ["warmup", "warm up", "warm-up"]],
]

/** Values that explicitly mean "no method here", as opposed to a typo. */
const EMPTY_METHOD_TOKENS = new Set(["", "-", "--", "—", "none", "no", "normal", "straight", "n/a", "na"])

function normalizeMethodToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const TAG_BY_ALIAS = new Map<string, IntensityTag>(
  INTENSITY_TAG_ALIASES.flatMap(([tag, aliases]) => aliases.map((alias) => [normalizeMethodToken(alias), tag])),
)

export function isIntensityTag(value: unknown): value is IntensityTag {
  return typeof value === "string" && (INTENSITY_TAGS as readonly string[]).includes(value)
}

/** Resolves one method word to a tag. Returns `undefined` for anything unknown. */
export function parseIntensityTag(value: unknown): IntensityTag | undefined {
  if (typeof value !== "string") return undefined

  return TAG_BY_ALIAS.get(normalizeMethodToken(value))
}

/**
 * Drops assignments outside `1..setCount`, keeps the last tag written for a set
 * and returns them in set order. This is what keeps a coach's tags honest when
 * they shrink an exercise from four sets to two in the editor.
 */
export function normalizeSetIntensityAssignments(
  assignments: readonly SetIntensityAssignment[] | undefined,
  setCount: number,
): SetIntensityAssignment[] {
  if (!assignments?.length) return []

  const bySetNumber = new Map<number, IntensityTag>()

  assignments.forEach((assignment) => {
    const setNumber = Number(assignment?.setNumber)

    if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > setCount) return
    if (!isIntensityTag(assignment?.tag)) return

    bySetNumber.set(setNumber, assignment.tag)
  })

  return Array.from(bySetNumber.entries())
    .sort(([left], [right]) => left - right)
    .map(([setNumber, tag]) => ({ setNumber, tag }))
}

/** Reads back the tags a saved exercise carries, so the editor reopens as saved. */
export function readSetIntensityAssignments(
  sets: ReadonlyArray<{ intensityTag?: IntensityTag; setNumber: number }>,
): SetIntensityAssignment[] {
  return sets.flatMap((set) => (set.intensityTag ? [{ setNumber: set.setNumber, tag: set.intensityTag }] : []))
}

export type ParsedIntensityMethod =
  | { assignments: SetIntensityAssignment[]; error?: undefined }
  | { assignments?: undefined; error: string }

/**
 * Reads a spreadsheet `Method` cell against an exercise of `setCount` sets.
 *
 * Four shapes, in the order they are recognised:
 * - blank, `-`, `normal` → no tags
 * - every token has a `set:method` form (`1:warmup,3:mrm`), or the single key
 *   `all` (`all:drop`) → those sets
 * - several bare tokens (`-, -, mrm`) → one per set, in order
 * - one bare token (`mrm`) → the last set, the common case for a finisher
 *
 * A typo or an out-of-range set number is an error rather than a silent skip: a
 * coach who wrote `1:myorep` meant something, and dropping it quietly would ship
 * a program missing the method they asked for.
 */
export function parseSetIntensityMethodCell(raw: unknown, setCount: number): ParsedIntensityMethod {
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim()

  if (!text || EMPTY_METHOD_TOKENS.has(normalizeMethodToken(text))) {
    return { assignments: [] }
  }

  if (!Number.isInteger(setCount) || setCount < 1) {
    return { error: "Method cần số Sets hợp lệ trước." }
  }

  const tokens = text.split(",").map((token) => token.trim())

  if (tokens.every((token) => token.includes(":"))) {
    const bySetNumber = new Map<number, IntensityTag>()

    for (const token of tokens) {
      const separatorIndex = token.indexOf(":")
      const key = normalizeMethodToken(token.slice(0, separatorIndex))
      const methodText = token.slice(separatorIndex + 1).trim()
      const tag = parseIntensityTag(methodText)

      if (!tag) {
        return { error: `Method '${methodText || "(trống)"}' không hợp lệ.` }
      }

      if (key === "all") {
        for (let setNumber = 1; setNumber <= setCount; setNumber += 1) {
          bySetNumber.set(setNumber, tag)
        }
        continue
      }

      const setNumber = Number(key)

      if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > setCount) {
        return { error: `Method chỉ định set ${key || "(trống)"} ngoài phạm vi 1-${setCount}.` }
      }

      bySetNumber.set(setNumber, tag)
    }

    return {
      assignments: Array.from(bySetNumber.entries())
        .sort(([left], [right]) => left - right)
        .map(([setNumber, tag]) => ({ setNumber, tag })),
    }
  }

  if (tokens.length > 1) {
    if (tokens.length > setCount) {
      return { error: `Method có ${tokens.length} giá trị nhưng bài tập chỉ có ${setCount} set.` }
    }

    const assignments: SetIntensityAssignment[] = []

    for (const [index, token] of tokens.entries()) {
      if (EMPTY_METHOD_TOKENS.has(normalizeMethodToken(token))) continue

      const tag = parseIntensityTag(token)

      if (!tag) {
        return { error: `Method '${token}' không hợp lệ.` }
      }

      assignments.push({ setNumber: index + 1, tag })
    }

    return { assignments }
  }

  const tag = parseIntensityTag(text)

  if (!tag) {
    return { error: `Method '${text}' không hợp lệ.` }
  }

  return { assignments: [{ setNumber: setCount, tag }] }
}
