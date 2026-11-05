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

import { parseAI } from "../../lib/ai/output-schemas"
import type { AIImageInput, AIProvider } from "../../lib/ai/types"
import { generateValidatedJSON } from "../../lib/ai/validated-generation"
import { sanitizeUserText } from "./prompts/shared"

const PROGRAM_IMAGE_PROMPT_VERSION = "2026-11-04.1"

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
              weight: looseNumber,
              weightUnit: looseText,
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
- Chia buổi tập: theo tên buổi/ngày nếu có (ví dụ "Upper", "Day 1", "Push"); nếu không có, mỗi khối bài liền nhau ngăn cách bởi dòng trống là một buổi. Đổi màu nền trong cùng một khối không tạo buổi mới. Giữ đúng thứ tự từ trên xuống.
- Buổi không có tên: để name là null.
- sets, rir, weight: số như trong ảnh; ô trống thì null. Không đoán.
- weightUnit: "kg" hoặc "lb" chỉ khi ảnh ghi rõ đơn vị (kể cả tiêu đề cột, ghi chú toàn bảng hoặc buổi tập); sao chép đơn vị được kế thừa đó vào từng dòng. Không tự đoán đơn vị khi ảnh không ghi: để null. Nếu ảnh ghi đơn vị khác, giữ nguyên trong weightUnit để coach kiểm tra; không đổi số weight.
- restTime: thời gian nghỉ tính bằng giây; đọc cột Rest/Rest time/Nghỉ, đổi phút hoặc mm:ss rõ ràng sang giây (ví dụ 2 phút hoặc 2:00 thành 120). Giữ 0 nếu ghi rõ 0; không có hoặc không xác định được thì null. Không dùng tempo làm thời gian nghỉ.
- reps: chép nguyên văn khoảng rep (ví dụ "8-12", "6-8/5-10"); trống thì null.
- note: cột ghi chú hoặc kiểu set (ví dụ "Topset-Backoffset"); trống thì null.
- Nếu ảnh có tiêu đề tuần (ví dụ "WEEK 2") chỉ chép một tuần đó, không nhân bản.
- Nếu ảnh không phải chương trình tập, trả về workouts rỗng.

## Trả về
Chỉ một JSON object, không markdown:
{"programName": string|null, "workouts": [{"name": string|null, "exercises": [{"name": string, "sets": number|null, "reps": string|null, "rir": number|null, "restTime": number|null, "weight": number|null, "weightUnit": string|null, "note": string|null}]}]}`

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
  /** Kilograms, only when the source's unit was unambiguous. */
  weight: number | null
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

/** Never turn a unitless or unsupported source load into an implicit kg prescription. */
function normalizedImageWeight(weight: number | null, rawUnit: string | null, locale: ImportLocale) {
  if (weight == null || weight < 0) return { note: null, weight: null }
  const unit = rawUnit?.trim().toLowerCase().replace(/\./g, "")
  if (unit && ["kg", "kgs", "kilogram", "kilograms"].includes(unit)) return { note: null, weight }
  if (unit && ["lb", "lbs", "pound", "pounds"].includes(unit)) {
    return { note: null, weight: Math.round(weight * 0.45359237 * 100) / 100 }
  }
  const sourceWeight = `${weight}${rawUnit ? ` ${rawUnit}` : ""}`
  return {
    note: locale === "vi"
      ? `Tạ trong ảnh: ${sourceWeight}. Cần xác nhận đơn vị trước khi nhập tạ (kg).`
      : `Weight in image: ${sourceWeight}. Confirm the unit before entering weight (kg).`,
    weight: null,
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
        const normalizedWeight = normalizedImageWeight(exercise.weight, exercise.weightUnit, input.locale)
        const setsMissing = !(exercise.sets && exercise.sets > 0)
        return {
          notes: [exercise.note, repsNote, normalizedWeight.note].filter(Boolean).join(" · "),
          reps,
          rir: exercise.rir != null && exercise.rir >= 0 && exercise.rir <= 10 ? exercise.rir : null,
          restTime: exercise.restTime != null && exercise.restTime >= 0 ? Math.round(exercise.restTime) : null,
          sets: setsMissing ? fallbackSets : Math.min(20, Math.max(1, Math.round(exercise.sets as number))),
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
  PROGRAM_IMAGE_PROMPT_VERSION,
  splitReps,
  weekLayout,
  type ImportedProgram,
  type LibraryVariation,
}
