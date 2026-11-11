/**
 * Reads a photo or screenshot of a training program into a draft the coach
 * reviews in the import dialog.
 *
 * Two steps, so neither prompt has to carry the whole exercise library:
 * 1. The vision model only transcribes what the image says: sessions, and per
 *    row the exercise name as written, sets, reps, RIR, weight and a note.
 * 2. Names are matched to the library here. An exact match needs no model; the
 *    rest go to one text call that may only pick from a short candidate list
 *    built for that row, or say none fits. Rows left unmatched still reach the
 *    review step, named as written, for the coach to pick an exercise.
 */
import { z } from "zod"

import { parseSetIntensityMethodCell, type SetIntensityAssignment } from "../../domain/set-intensity-tag"
import { parseAI } from "../../lib/ai/output-schemas"
import type { AIImageInput, AIProvider } from "../../lib/ai/types"
import { generateValidatedJSON } from "../../lib/ai/validated-generation"
import { sanitizeUserText } from "./prompts/shared"

const PROGRAM_IMAGE_PROMPT_VERSION = "2026-11-11.1"

const MAX_WORKOUTS = 14
const MAX_EXERCISES_PER_WORKOUT = 30
/** Candidates the matcher offers the model for one row. */
const CANDIDATES_PER_ROW = 8

type ImportLocale = "vi" | "en"

// ---------------------------------------------------------------------------
// Step 1: transcription
// ---------------------------------------------------------------------------

const looseNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") return null
    const parsed = typeof value === "number" ? value : Number(String(value).replace(",", ".").trim())
    return Number.isFinite(parsed) ? parsed : null
  })

const looseText = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => (value == null ? null : String(value).trim() || null))

const transcriptionSchema = z.object({
  programName: looseText,
  workouts: z
    .array(
      z.object({
        name: looseText,
        exercises: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              sets: looseNumber,
              reps: looseText,
              rir: looseNumber,
              restTime: looseNumber,
              /** As written: "65,50" may be one weight per set, so it is parsed here, not by the schema. */
              weight: looseText,
              weightUnit: looseText,
              /** The set scheme / set type cell, e.g. "Topset-Backoffset". */
              setScheme: looseText,
              note: looseText,
            }),
          )
          .max(MAX_EXERCISES_PER_WORKOUT),
      }),
    )
    .max(MAX_WORKOUTS),
})

type Transcription = z.infer<typeof transcriptionSchema>

const TRANSCRIBE_SYSTEM_PROMPT = `Bạn đọc ảnh chụp hoặc ảnh màn hình một chương trình tập (thường là bảng tính) và chép lại thành JSON. Bạn chỉ CHÉP, không sáng tác.

## Quy tắc
- Chỉ chép những bài tập thực sự có trong ảnh, đúng tên như được viết (giữ nguyên tiếng Anh, viết tắt như "SA", "DB", "1 Arm"). Không thêm, không bỏ, không đổi bài.
- Bỏ qua dòng trống, dòng tiêu đề cột và các ô không phải bài tập.
- Chia buổi tập, theo thứ tự ưu tiên:
  1. Có cột số ngày/buổi (thường là ô gộp ở mép trái, ghi 1, 2, 3... hoặc "Day 1"): mỗi số là một buổi riêng, kể cả khi giữa các ngày không có dòng trống. Dải màu nền xen kẽ đổi cùng lúc với số ngày xác nhận ranh giới đó.
  2. Có tên buổi/ngày (ví dụ "Upper", "Push"): mỗi tên là một buổi.
  3. Không có cả hai: mỗi khối bài liền nhau ngăn cách bởi dòng trống là một buổi.
  Đổi màu nền bên trong cùng một ngày (ví dụ tô theo nhóm cơ) không tạo buổi mới. Ngày không có bài tập nào thì bỏ qua. Giữ đúng thứ tự từ trên xuống.
- Buổi không có tên (chỉ có số ngày hoặc không có gì): để name là null.
- sets, rir: số như trong ảnh; ô trống thì null. Không đoán.
- weight: chép nguyên văn ô tạ thành chuỗi (ví dụ "60", "62,5", hoặc "65,50" khi mỗi set một mức tạ); ô trống thì null. Không tự cộng, gộp hay đổi số.
- weightUnit: "kg" hoặc "lb" chỉ khi ảnh ghi rõ đơn vị (kể cả tiêu đề cột như "Weight (Kg)", ghi chú toàn bảng hoặc buổi tập); sao chép đơn vị được kế thừa đó vào từng dòng. Không tự đoán đơn vị khi ảnh không ghi: để null. Nếu ảnh ghi đơn vị khác, giữ nguyên trong weightUnit để coach kiểm tra; không đổi số weight.
- restTime: thời gian nghỉ tính bằng giây; đọc cột Rest/Rest time/Nghỉ, đổi phút hoặc mm:ss rõ ràng sang giây (ví dụ 2 phút hoặc 2:00 thành 120). Giữ 0 nếu ghi rõ 0; không có hoặc không xác định được thì null. Không dùng tempo làm thời gian nghỉ.
- reps: chép nguyên văn khoảng rep mục tiêu (ví dụ "8-12", "6-8/5-10"); trống thì null. Nếu bảng có cả cột "Reps" và cột "Rep Range"/"Target"/"Mục tiêu", lấy cột khoảng rep mục tiêu; cột "Reps" khi đó thường là số rep đã tập lần trước, không dùng làm reps. Chỉ có một cột rep thì dùng cột đó.
- setScheme: chép nguyên văn cột kiểu set (Set Scheme, Set Type, Method, Kiểu set; ví dụ "Topset-Backoffset", "1 Topset-Backoffset", "Drop set"); không có thì null. Không đưa kiểu set vào note.
- note: chỉ cột ghi chú; trống thì null.
- Nếu ảnh có tiêu đề tuần (ví dụ "WEEK 2") chỉ chép một tuần đó, không nhân bản.
- Nếu ảnh không phải chương trình tập, trả về workouts rỗng.

## Trả về
Chỉ một JSON object, không markdown:
{"programName": string|null, "workouts": [{"name": string|null, "exercises": [{"name": string, "sets": number|null, "reps": string|null, "rir": number|null, "restTime": number|null, "weight": string|null, "weightUnit": string|null, "setScheme": string|null, "note": string|null}]}]}`

async function transcribeProgramImages(provider: AIProvider, images: AIImageInput[]) {
  return generateValidatedJSON(
    provider,
    {
      images,
      maxTokens: 4000,
      repairInstruction: "Trả về JSON đầy đủ đã sửa lỗi này, chỉ chép bài tập có trong ảnh.",
      systemPrompt: TRANSCRIBE_SYSTEM_PROMPT,
      userPrompt: `Chép chương trình tập trong ${images.length > 1 ? `${images.length} ảnh (theo thứ tự)` : "ảnh"} thành JSON.`,
    },
    (value) => parseAI(transcriptionSchema, value),
  )
}

// ---------------------------------------------------------------------------
// Step 2: matching names to the library
// ---------------------------------------------------------------------------

type LibraryVariation = {
  variationId: string
  /** The label the coach sees in the exercise picker, e.g. "High to Low Cable Chest Fly". */
  displayName?: string
  exerciseName: string
  variationName: string
  equipment: string | null
}

/** Shorthand coaches write in sheets, spelled out so it can meet the library's names. */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\b(sa|1 ?arm|one ?arm|single ?arm|1a)\b/g, "single arm"],
  [/\b(sl|1 ?leg|one ?leg)\b/g, "single leg"],
  [/\bdbs?\b/g, "dumbbell"],
  [/\bbb\b/g, "barbell"],
  [/\bkb\b/g, "kettlebell"],
  [/\brdl\b/g, "romanian deadlift"],
  [/\bsldl\b/g, "stiff leg deadlift"],
  [/\bohp\b/g, "overhead press"],
  [/\bez\b/g, "ez bar"],
  [/\bpec ?deck\b/g, "pec deck"],
  [/\bpecdeck\b/g, "pec deck"],
  [/\bflyes\b/g, "fly"],
  [/\bflies\b/g, "fly"],
  [/\bflys\b/g, "fly"],
  [/\brear ?delt\b/g, "rear delt"],
  [/\breardelt\b/g, "rear delt"],
  [/\bpull ?down\b/g, "pulldown"],
  [/\bpush ?down\b/g, "pushdown"],
  [/\bext\b/g, "extension"],
  [/\bincl\b/g, "incline"],
]

function normalizeExerciseName(value: string) {
  let text = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  for (const [pattern, replacement] of ABBREVIATIONS) text = text.replace(pattern, replacement)
  return text.replace(/\s+/g, " ").trim()
}

/** Words that say nothing about which exercise it is. */
const FILLER = new Set(["the", "a", "an", "with", "on", "of", "and", "to", "system", "default"])

function tokensOf(value: string) {
  return new Set(
    normalizeExerciseName(value)
      .split(" ")
      .filter((token) => token && !FILLER.has(token))
      .map((token) => (token.length > 3 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token)),
  )
}

function variationLabel(variation: LibraryVariation) {
  const variationName = variation.variationName.trim()
  return /^default$/i.test(variationName) ? variation.exerciseName : `${variation.exerciseName} ${variationName}`
}

/**
 * Every name a coach may know the variation by: the picker's display name
 * (variation words in front, as in "High to Low Cable Chest Fly") and the raw
 * "exercise + variation" pair a sheet might copy instead.
 */
function variationNames(variation: LibraryVariation) {
  return [...new Set([variation.displayName?.trim(), variationLabel(variation)].filter((name): name is string => Boolean(name)))]
}

/** Overlap of the row's words with the variation's, weighted toward covering the row. */
function similarity(rowTokens: Set<string>, variation: LibraryVariation) {
  if (rowTokens.size === 0) return 0
  return Math.max(
    ...variationNames(variation).map((name) => {
      const candidate = tokensOf(`${name} ${variation.equipment ?? ""}`)
      let shared = 0
      for (const token of rowTokens) if (candidate.has(token)) shared += 1
      return shared / rowTokens.size + (shared / Math.max(tokensOf(name).size, 1)) * 0.5
    }),
  )
}

function buildLibraryIndex(library: LibraryVariation[]) {
  const exact = new Map<string, LibraryVariation>()
  for (const variation of library) {
    for (const name of variationNames(variation)) {
      const key = normalizeExerciseName(name)
      if (!exact.has(key)) exact.set(key, variation)
    }
    // "Leg Press" with its Default variation also answers to the exercise name alone.
    const exerciseKey = normalizeExerciseName(variation.exerciseName)
    if (/^default$/i.test(variation.variationName.trim()) && !exact.has(exerciseKey)) exact.set(exerciseKey, variation)
  }
  return {
    exact(name: string) {
      return exact.get(normalizeExerciseName(name)) ?? null
    },
    candidates(name: string, limit = CANDIDATES_PER_ROW) {
      const rowTokens = tokensOf(name)
      return library
        .map((variation) => ({ score: similarity(rowTokens, variation), variation }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map((entry) => entry.variation)
    },
  }
}

const matchSchema = z.object({
  matches: z.array(z.object({ row: z.string(), ref: z.string().nullable().optional() })),
})

const MATCH_SYSTEM_PROMPT = `Bạn ghép tên bài tập chép từ chương trình tập của coach với thư viện bài tập của app.

## Quy tắc
- Mỗi dòng có tên như coach viết và vài ứng viên (ref | tên bài | dụng cụ). Chọn đúng ref của ứng viên cùng chuyển động, cùng dụng cụ và cùng kiểu (một tay/hai tay, ngồi/đứng, góc nghiêng).
- Chỉ dùng ref có trong danh sách ứng viên của chính dòng đó.
- Không có ứng viên nào là cùng bài: trả ref null. Thà null còn hơn chọn bài gần giống; coach sẽ tự chọn.
- Trả đủ mọi dòng, giữ nguyên mã dòng.

## Trả về
Chỉ một JSON object, không markdown:
{"matches": [{"row": string, "ref": string|null}]}`

type PendingRow = { key: string; name: string; candidates: LibraryVariation[] }

async function matchWithModel(provider: AIProvider, rows: PendingRow[]) {
  const refs = new Map<string, Map<string, string>>()
  const lines = rows.map((row) => {
    const byRef = new Map<string, string>()
    const options = row.candidates.map((candidate, index) => {
      const ref = `${row.key}.${index + 1}`
      byRef.set(ref, candidate.variationId)
      return `    - ${ref} | ${sanitizeUserText(candidate.displayName ?? variationLabel(candidate))} | ${candidate.equipment ?? "?"}`
    })
    refs.set(row.key, byRef)
    return [`- ${row.key}: <trainee_input>${sanitizeUserText(row.name)}</trainee_input>`, ...options].join("\n")
  })

  const { data, tokenUsage } = await generateValidatedJSON(
    provider,
    {
      maxTokens: 1500,
      repairInstruction: "Trả về JSON đầy đủ đã sửa lỗi này, chỉ dùng ref trong danh sách ứng viên của từng dòng.",
      systemPrompt: MATCH_SYSTEM_PROMPT,
      userPrompt: ["## Các dòng cần ghép", ...lines].join("\n"),
    },
    (value) => parseAI(matchSchema, value),
  )

  const chosen = new Map<string, string>()
  for (const match of data.matches) {
    const variationId = match.ref ? refs.get(match.row)?.get(match.ref.trim()) : undefined
    // A ref outside the row's own candidates is ignored, never trusted.
    if (variationId) chosen.set(match.row, variationId)
  }
  return { chosen, tokenUsage }
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------

type ImportedExercise = {
  /** The name as written in the image, shown when it found no library match. */
  sourceName: string
  /** Null when nothing in the library fits; the coach picks one in review. */
  variationId: string | null
  sets: number
  /** "8-12" or "10", ready for the shared rep parser. */
  reps: string
  rir: number | null
  /** Seconds; null when the source did not specify a rest period. */
  restTime: number | null
  /** Kilograms, only when the source's unit was unambiguous. With one weight per set, the first set's. */
  weight: number | null
  /** Per-set methods read from the set scheme cell; empty when it named none the app knows. */
  setIntensityTags: SetIntensityAssignment[]
  /**
   * Under a top set + back-off scheme, the back-off sets' own reps and weight
   * when the sheet gives them ("6-8/5-10", "65,50"). Null when they match the
   * top set or the sheet does not say.
   */
  backOff: { reps: string; weight: number | null } | null
  notes: string
}

type ImportedProgram = {
  programName: string | null
  workouts: Array<{ name: string; scheduledDay: number; exercises: ImportedExercise[] }>
  unmatchedCount: number
  promptVersion: string
  tokenUsage: number
}

/** "6-8/5-10" is a top set and back-off sets: keep the first range, note the rest. */
function splitReps(raw: string | null) {
  if (!raw) return { note: null, reps: "10" }
  const cleaned = raw.replace(/[–—]/g, "-").replace(/\s+/g, "")
  const [first] = cleaned.split(/[/,;|]/)
  const reps = /^\d+(-\d+)?$/.test(first ?? "") ? (first as string) : "10"
  const note = cleaned !== reps ? `Reps: ${raw.trim()}` : null
  return { note, reps }
}

/** Each range of a reps cell in order: "6-8/5-10" is ["6-8", "5-10"]; empty when one part is unreadable. */
function repRanges(raw: string | null) {
  const parts = (raw ?? "").replace(/[–—]/g, "-").replace(/\s+/g, "").split(/[/;|]/).filter(Boolean)
  return parts.every((part) => /^\d+(-\d+)?$/.test(part)) ? parts : []
}

function isTopBackOffScheme(tags: readonly SetIntensityAssignment[], sets: number) {
  return sets > 1 && tags.length === sets && tags.every(({ setNumber, tag }) => tag === (setNumber === 1 ? "top_set" : "back_off"))
}

/**
 * The back-off sets' reps and weight under a top set, from a reps cell with
 * one range per role and a weight cell with one load per role. Only two-part
 * cells map cleanly: anything longer stays in the notes for the coach.
 */
function backOffFromCells(input: {
  perSetKg: number[] | null
  reps: string
  rawReps: string | null
  tags: readonly SetIntensityAssignment[]
  sets: number
  weight: number | null
}) {
  if (!isTopBackOffScheme(input.tags, input.sets)) return null
  const ranges = repRanges(input.rawReps)
  const backOffReps = ranges.length === 2 ? ranges[1] : null
  const backOffWeight = input.perSetKg?.length === 2 ? input.perSetKg[1] : null
  if (backOffReps == null && backOffWeight == null) return null
  return {
    backOff: { reps: backOffReps ?? input.reps, weight: backOffWeight ?? input.weight },
    repsMapped: backOffReps != null,
    weightMapped: backOffWeight != null,
  }
}

/**
 * A set scheme cell as per-set methods. "Topset-Backoffset" (also "1 Topset-Backoffset",
 * "top/backoff", "2 top sets + back-off") is the leading sets as top sets and the rest as
 * back-off sets; anything else goes through the Method-cell grammar the sheet import uses.
 * Null when the cell names nothing the app knows, so the text can stay in the notes.
 */
function setSchemeTags(raw: string | null, sets: number): SetIntensityAssignment[] | null {
  if (!raw || sets < 1) return null
  const text = raw.toLowerCase().replace(/[_+&/,|–—-]+/g, " ").replace(/\s+/g, " ").trim()
  const topBackOff = /^(?:(\d+) ?x? ?)?top(?: ?sets?)? (?:(?:then|and|with) )?(?:\d+ ?x? ?)?back ?off(?: ?sets?)?$/.exec(text)
  if (topBackOff) {
    const topSets = sets === 1 ? 1 : Math.min(sets - 1, Math.max(1, Number(topBackOff[1] ?? 1)))
    return Array.from({ length: sets }, (_, index) => ({
      setNumber: index + 1,
      tag: index < topSets ? ("top_set" as const) : ("back_off" as const),
    }))
  }
  const parsed = parseSetIntensityMethodCell(raw, sets)
  return parsed.assignments?.length ? parsed.assignments : null
}

const KG_UNITS = ["kg", "kgs", "kilogram", "kilograms"]
const LB_UNITS = ["lb", "lbs", "pound", "pounds"]

/**
 * The weight cell as one value per set it lists. A comma is a decimal point in
 * "62,5", but between two whole numbers of an exercise with several sets
 * ("65,50") it separates the top set from the back-off sets. Empty when the
 * cell is blank or unreadable.
 */
function parseImageWeights(raw: string | null, sets: number): number[] {
  const text = raw?.replace(/[–—]/g, "-").replace(/(kgs?|kilograms?|lbs?|pounds?)\b\.?/gi, " ").trim()
  if (!text) return []
  let parts = text.split(/[/;|]|,\s+|\s+/).filter(Boolean)
  if (parts.length === 1) {
    const commaList = /^\d+(?:,\d+)+$/.test(parts[0] as string) ? (parts[0] as string).split(",") : null
    const decimal = commaList?.length === 2 && ((commaList[1] as string).length === 1 || sets < 2)
    if (commaList && !decimal) parts = commaList
  }
  const values = parts.map((part) => (/^-?\d+(?:[.,]\d+)?$/.test(part) ? Number(part.replace(",", ".")) : Number.NaN))
  return values.every(Number.isFinite) ? values : []
}

function formatKg(value: number) {
  return String(Math.round(value * 100) / 100)
}

/**
 * Never turn a unitless or unsupported source load into an implicit kg
 * prescription. A cell with one weight per set prescribes the first set's and
 * keeps the full list in the notes.
 */
function normalizedImageWeight(raw: string | null, rawUnit: string | null, sets: number, locale: ImportLocale) {
  const values = parseImageWeights(raw, sets)
  const unitInCell = raw?.match(/(kgs?|kilograms?|lbs?|pounds?)\b/i)?.[1] ?? null
  const unit = (rawUnit ?? unitInCell)?.trim().toLowerCase().replace(/\./g, "")
  const knownUnit = unit && (KG_UNITS.includes(unit) || LB_UNITS.includes(unit))

  if (values.length === 0 || values.some((value) => value < 0)) {
    const unreadable = raw && values.length === 0 && !/^[-–—\s]*$/.test(raw)
    return {
      note: unreadable ? (locale === "vi" ? `Tạ trong ảnh: ${raw}` : `Weight in image: ${raw}`) : null,
      weight: null,
    }
  }
  if (!knownUnit) {
    const sourceWeight = `${raw}${rawUnit ? ` ${rawUnit}` : ""}`
    return {
      note: locale === "vi"
        ? `Tạ trong ảnh: ${sourceWeight}. Cần xác nhận đơn vị trước khi nhập tạ (kg).`
        : `Weight in image: ${sourceWeight}. Confirm the unit before entering weight (kg).`,
      weight: null,
    }
  }

  const kg = values.map((value) => (LB_UNITS.includes(unit) ? Math.round(value * 0.45359237 * 100) / 100 : value))
  const perSet = kg.length > 1 && kg.some((value) => value !== kg[0])
  return {
    perSetKg: perSet ? kg : null,
    note: perSet
      ? `${locale === "vi" ? "Tạ từng set" : "Weight per set"}: ${kg.map(formatKg).join(" / ")} kg`
      : null,
    weight: kg[0] as number,
  }
}

function mostCommon(values: number[]) {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] ?? null
}

/** Weekdays (Date#getDay) for n sessions, with rest days between them where the week allows. */
function weekLayout(count: number) {
  const layouts: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
  }
  return layouts[count] ?? [1, 2, 3, 4, 5, 6, 0]
}

function workoutName(index: number, locale: ImportLocale) {
  return locale === "en" ? `Session ${index + 1}` : `Buổi ${index + 1}`
}

async function importProgramFromImages(
  provider: AIProvider,
  input: { images: AIImageInput[]; library: LibraryVariation[]; locale: ImportLocale },
): Promise<ImportedProgram> {
  const transcription: { data: Transcription; tokenUsage: number } = await transcribeProgramImages(provider, input.images)
  let tokenUsage = transcription.tokenUsage
  const workouts = transcription.data.workouts.filter((workout) => workout.exercises.length > 0)

  const index = buildLibraryIndex(input.library)
  const matched = new Map<string, string>()
  const pending: PendingRow[] = []
  workouts.forEach((workout, workoutIdx) => {
    workout.exercises.forEach((exercise, exerciseIdx) => {
      const key = `r${workoutIdx + 1}_${exerciseIdx + 1}`
      const exact = index.exact(exercise.name)
      if (exact) {
        matched.set(key, exact.variationId)
        return
      }
      const candidates = index.candidates(exercise.name)
      if (candidates.length > 0) pending.push({ candidates, key, name: exercise.name })
    })
  })

  if (pending.length > 0) {
    const result = await matchWithModel(provider, pending)
    tokenUsage += result.tokenUsage
    for (const [key, variationId] of result.chosen) matched.set(key, variationId)
  }

  let unmatchedCount = 0
  const days = weekLayout(workouts.length)
  const imported = workouts.map((workout, workoutIdx) => {
    const knownSets = workout.exercises.flatMap((exercise) => (exercise.sets && exercise.sets > 0 ? [Math.round(exercise.sets)] : []))
    const fallbackSets = mostCommon(knownSets) ?? 3
    return {
      exercises: workout.exercises.map((exercise, exerciseIdx) => {
        const variationId = matched.get(`r${workoutIdx + 1}_${exerciseIdx + 1}`) ?? null
        if (!variationId) unmatchedCount += 1
        const { note: repsNote, reps } = splitReps(exercise.reps)
        const setsMissing = !(exercise.sets && exercise.sets > 0)
        const sets = setsMissing ? fallbackSets : Math.min(20, Math.max(1, Math.round(exercise.sets as number)))
        const normalizedWeight = normalizedImageWeight(exercise.weight, exercise.weightUnit, sets, input.locale)
        // A model that still writes the scheme into the note column gets the same treatment.
        const schemeTags = setSchemeTags(exercise.setScheme, sets)
        const noteTags = schemeTags || exercise.setScheme ? null : setSchemeTags(exercise.note, sets)
        const unknownScheme = schemeTags ? null : exercise.setScheme
        const setIntensityTags = schemeTags ?? noteTags ?? []
        // A top set and its back-off sets written in one cell become two rows, not a note.
        const backOff = backOffFromCells({
          perSetKg: normalizedWeight.perSetKg ?? null,
          rawReps: exercise.reps,
          reps,
          sets,
          tags: setIntensityTags,
          weight: normalizedWeight.weight,
        })
        return {
          backOff: backOff?.backOff ?? null,
          notes: [
            unknownScheme,
            noteTags ? null : exercise.note,
            backOff?.repsMapped ? null : repsNote,
            backOff?.weightMapped ? null : normalizedWeight.note,
          ].filter(Boolean).join(" · "),
          reps,
          rir: exercise.rir != null && exercise.rir >= 0 && exercise.rir <= 10 ? exercise.rir : null,
          restTime: exercise.restTime != null && exercise.restTime >= 0 ? Math.round(exercise.restTime) : null,
          setIntensityTags,
          sets,
          sourceName: exercise.name,
          variationId,
          weight: normalizedWeight.weight,
        }
      }),
      name: workout.name?.slice(0, 80) || workoutName(workoutIdx, input.locale),
      scheduledDay: days[workoutIdx % days.length] as number,
    }
  })

  return {
    programName: transcription.data.programName?.slice(0, 120) ?? null,
    promptVersion: PROGRAM_IMAGE_PROMPT_VERSION,
    tokenUsage,
    unmatchedCount,
    workouts: imported,
  }
}

export {
  buildLibraryIndex,
  importProgramFromImages,
  normalizeExerciseName,
  parseImageWeights,
  PROGRAM_IMAGE_PROMPT_VERSION,
  setSchemeTags,
  splitReps,
  weekLayout,
  type ImportedProgram,
  type LibraryVariation,
}
