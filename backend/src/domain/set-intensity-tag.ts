import { $Enums } from "@prisma/client"

/**
 * Per-set training method a coach prescribes: "do set 3 as a myo-rep match".
 *
 * A set with no tag is a normal straight set, which is why every accessor here
 * treats an unknown or missing value as `undefined` rather than an error — the
 * tag is a hint for the trainee, never a requirement for logging the set.
 *
 * The frontend mirror of this module lives in `lib/workout/intensity-tag.ts`;
 * the backend cannot import it because its `rootDir` is `src`. Keep the tag
 * list, the aliases and the method-cell grammar in step across both.
 */

type SetIntensityTag = $Enums.SetIntensityTag

type SetIntensityAssignment = {
  setNumber: number
  tag: SetIntensityTag
}

// A readonly tuple rather than an array so `z.enum()` at the route boundary keeps
// the literal union instead of widening to `string`.
const SET_INTENSITY_TAGS = ["mrm", "drop_set", "rest_pause", "cluster", "failure", "warmup"] as const satisfies readonly SetIntensityTag[]

/**
 * The short badge the trainee sees. Mirrors `INTENSITY_TAG_BADGES` on the
 * frontend, and is what coach-update banners print rather than the enum name.
 */
const SET_INTENSITY_TAG_BADGES: Record<SetIntensityTag, string> = {
  cluster: "CLS",
  drop_set: "DROP",
  failure: "FAIL",
  mrm: "MRM",
  rest_pause: "RP",
  warmup: "WU",
}

/**
 * What a coach may type in the sheet's `Method` cell. The canonical value is
 * always accepted; the rest are the spellings coaches actually use.
 */
const SET_INTENSITY_TAG_ALIASES: Array<[SetIntensityTag, string[]]> = [
  ["mrm", ["mrm", "myo match", "myo-rep match", "myo rep match", "myomatch"]],
  ["drop_set", ["drop", "drop set", "dropset", "drop_set"]],
  ["rest_pause", ["rp", "rest pause", "rest-pause", "rest_pause", "restpause"]],
  ["cluster", ["cluster", "cls"]],
  ["failure", ["failure", "fail", "to failure"]],
  ["warmup", ["warmup", "warm up", "warm-up"]],
]

/**
 * The spelling each tag gets in a sheet's Method dropdown. The canonical enum
 * names read badly in a picker, and `drop` / `rp` are what coaches write anyway;
 * every one of these resolves through the aliases above.
 */
const SET_INTENSITY_METHOD_SHEET_TOKENS: Record<SetIntensityTag, string> = {
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
const SET_INTENSITY_METHOD_CHOICES: string[] = [
  "-",
  ...SET_INTENSITY_TAGS.map((tag) => SET_INTENSITY_METHOD_SHEET_TOKENS[tag]),
  ...SET_INTENSITY_TAGS.map((tag) => `all:${SET_INTENSITY_METHOD_SHEET_TOKENS[tag]}`),
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

const TAG_BY_ALIAS = new Map<string, SetIntensityTag>(
  SET_INTENSITY_TAG_ALIASES.flatMap(([tag, aliases]) => aliases.map((alias) => [normalizeMethodToken(alias), tag])),
)

function isSetIntensityTag(value: unknown): value is SetIntensityTag {
  return typeof value === "string" && (SET_INTENSITY_TAGS as readonly string[]).includes(value)
}

/** Resolves one method word to a tag. Returns `undefined` for anything unknown. */
function parseSetIntensityTag(value: unknown): SetIntensityTag | undefined {
  if (typeof value !== "string") return undefined

  return TAG_BY_ALIAS.get(normalizeMethodToken(value))
}

/**
 * Drops assignments outside `1..setCount`, keeps the last tag written for a set
 * and returns them in set order. Used wherever a coach's set count and their tag
 * list can disagree: shrinking an exercise from four sets to two, or an import
 * row naming set 5 of a three-set exercise.
 */
function normalizeSetIntensityAssignments(
  assignments: readonly SetIntensityAssignment[] | undefined,
  setCount: number,
): SetIntensityAssignment[] {
  if (!assignments?.length) return []

  const bySetNumber = new Map<number, SetIntensityTag>()

  assignments.forEach((assignment) => {
    const setNumber = Number(assignment?.setNumber)

    if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > setCount) return
    if (!isSetIntensityTag(assignment?.tag)) return

    bySetNumber.set(setNumber, assignment.tag)
  })

  return Array.from(bySetNumber.entries())
    .sort(([left], [right]) => left - right)
    .map(([setNumber, tag]) => ({ setNumber, tag }))
}

/** Lookup keyed by set number, for building `ExerciseSet` rows. */
function buildSetIntensityTagMap(
  assignments: readonly SetIntensityAssignment[] | undefined,
  setCount: number,
): Map<number, SetIntensityTag> {
  return new Map(normalizeSetIntensityAssignments(assignments, setCount).map(({ setNumber, tag }) => [setNumber, tag]))
}

type ParsedSetIntensityMethod =
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
 * A typo or an out-of-range set number is an error rather than a silent skip:
 * a coach who wrote `1:myorep` meant something, and dropping it quietly would
 * ship a program missing the method they asked for.
 */
function parseSetIntensityMethodCell(raw: unknown, setCount: number): ParsedSetIntensityMethod {
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim()

  if (!text || EMPTY_METHOD_TOKENS.has(normalizeMethodToken(text))) {
    return { assignments: [] }
  }

  if (!Number.isInteger(setCount) || setCount < 1) {
    return { error: "Method cần số Sets hợp lệ trước." }
  }

  const tokens = text.split(",").map((token) => token.trim())

  if (tokens.every((token) => token.includes(":"))) {
    const bySetNumber = new Map<number, SetIntensityTag>()

    for (const token of tokens) {
      const separatorIndex = token.indexOf(":")
      const key = normalizeMethodToken(token.slice(0, separatorIndex))
      const methodText = token.slice(separatorIndex + 1).trim()
      const tag = parseSetIntensityTag(methodText)

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

      const tag = parseSetIntensityTag(token)

      if (!tag) {
        return { error: `Method '${token}' không hợp lệ.` }
      }

      assignments.push({ setNumber: index + 1, tag })
    }

    return { assignments }
  }

  const tag = parseSetIntensityTag(text)

  if (!tag) {
    return { error: `Method '${text}' không hợp lệ.` }
  }

  return { assignments: [{ setNumber: setCount, tag }] }
}

export {
  SET_INTENSITY_METHOD_CHOICES,
  SET_INTENSITY_TAGS,
  SET_INTENSITY_TAG_BADGES,
  buildSetIntensityTagMap,
  isSetIntensityTag,
  normalizeSetIntensityAssignments,
  parseSetIntensityMethodCell,
  parseSetIntensityTag,
}
export type { ParsedSetIntensityMethod, SetIntensityAssignment, SetIntensityTag }
