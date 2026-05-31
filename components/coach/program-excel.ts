import type { CoachTrainee, CreateCoachProgramInput, ExerciseVariationOption } from "@/lib/fitness/types"
import { parseRepTargetText } from "@/lib/workout-reps"

type RawCell = string | number | boolean | null | undefined

type ImportedProgramDraft = {
  assignToUserIds?: string[]
  description?: string
  difficulty?: CreateCoachProgramInput["difficulty"]
  duration?: number
  name?: string
  workouts: CreateCoachProgramInput["workouts"]
}

type ProgramFieldKey = "assignToEmails" | "description" | "difficulty" | "duration" | "name"

type WorkoutColumnKey =
  | "exerciseName"
  | "reps"
  | "scheduledDay"
  | "sets"
  | "variationId"
  | "variationName"
  | "weight"
  | "workoutName"

const PROGRAM_SHEET_NAME = "Program"
const WORKOUTS_SHEET_NAME = "Workouts"
const INSTRUCTIONS_SHEET_NAME = "Instructions"
const REFERENCE_SHEET_NAME = "Reference"
const TRAINEES_SHEET_NAME = "Trainees"

const PROGRAM_FIELD_ROWS: Array<[string, string]> = [
  ["name", ""],
  ["description", ""],
  ["duration_weeks", ""],
  ["difficulty", ""],
  ["assign_to_emails", ""],
]

const WORKOUT_HEADERS = [
  "workout_name",
  "scheduled_day",
  "exercise_name",
  "variation_name",
  "variation_id",
  "sets",
  "reps_range",
  "weight",
] as const

const DIFFICULTY_MAP = new Map<string, CreateCoachProgramInput["difficulty"]>([
  ["advanced", "advanced"],
  ["beginner", "beginner"],
  ["intermediate", "intermediate"],
])

const DAY_ALIASES: Array<[number, string[]]> = [
  [0, ["0", "7", "cn", "chu nhat", "chủ nhật", "chunhat", "chủnhật", "sun", "sunday"]],
  [1, ["1", "t2", "t 2", "thu 2", "thứ 2", "thu2", "thứ2", "thu hai", "thứ hai", "thuhai", "m2", "mon", "monday"]],
  [2, ["2", "t3", "t 3", "thu 3", "thứ 3", "thu3", "thứ3", "thu ba", "thứ ba", "thuba", "m3", "tue", "tues", "tuesday"]],
  [3, ["3", "t4", "t 4", "thu 4", "thứ 4", "thu4", "thứ4", "thu tu", "thứ tư", "thutu", "m4", "wed", "weds", "wednesday"]],
  [4, ["4", "t5", "t 5", "thu 5", "thứ 5", "thu5", "thứ5", "thu nam", "thứ năm", "thunam", "m5", "thu", "thur", "thurs", "thursday"]],
  [5, ["5", "t6", "t 6", "thu 6", "thứ 6", "thu6", "thứ6", "thu sau", "thứ sáu", "thusau", "m6", "fri", "friday"]],
  [6, ["6", "t7", "t 7", "thu 7", "thứ 7", "thu7", "thứ7", "thu bay", "thứ bảy", "thubay", "m7", "sat", "saturday"]],
]

const WEEKDAY_ORDER_ALIASES: Array<[number, string[]]> = [
  [1, ["day 1", "day1", "ngay 1", "ngày 1", "ngay1", "ngày1", "buoi 1", "buổi 1", "buoi1", "buổi1"]],
  [2, ["day 2", "day2", "ngay 2", "ngày 2", "ngay2", "ngày2", "buoi 2", "buổi 2", "buoi2", "buổi2"]],
  [3, ["day 3", "day3", "ngay 3", "ngày 3", "ngay3", "ngày3", "buoi 3", "buổi 3", "buoi3", "buổi3"]],
  [4, ["day 4", "day4", "ngay 4", "ngày 4", "ngay4", "ngày4", "buoi 4", "buổi 4", "buoi4", "buổi4"]],
  [5, ["day 5", "day5", "ngay 5", "ngày 5", "ngay5", "ngày5", "buoi 5", "buổi 5", "buoi5", "buổi5"]],
  [6, ["day 6", "day6", "ngay 6", "ngày 6", "ngay6", "ngày6", "buoi 6", "buổi 6", "buoi6", "buổi6"]],
  [0, ["day 7", "day7", "ngay 7", "ngày 7", "ngay7", "ngày7", "buoi 7", "buổi 7", "buoi7", "buổi7"]],
]

const PROGRAM_FIELD_ALIASES: Record<ProgramFieldKey, string[]> = {
  assignToEmails: ["assign_to_emails", "assigntoemails", "emails", "trainee_emails"],
  description: ["description", "program_description"],
  difficulty: ["difficulty", "level"],
  duration: ["duration", "duration_weeks", "weeks"],
  name: ["name", "program_name"],
}

const WORKOUT_COLUMN_ALIASES: Record<WorkoutColumnKey, string[]> = {
  exerciseName: ["exercise", "exercise_name", "exercisename"],
  reps: ["reps", "reps_range", "repsrange", "target_reps", "targetreps", "target_reps_range", "targetrepsrange"],
  scheduledDay: ["day", "scheduled_day", "scheduledday", "weekday"],
  sets: ["sets"],
  variationId: ["exercise_variation_id", "variation_id", "variationid"],
  variationName: ["variation", "variation_name", "variationname"],
  weight: ["load", "weight"],
  workoutName: ["day_name", "session_name", "workout_name", "workoutname"],
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "")
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeDayLookup(value: string) {
  const spaced = stripDiacritics(value)
    .toLowerCase()
    .replace(/[.,;:/\\()[\]{}]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    compact: spaced.replace(/\s+/g, ""),
    spaced,
  }
}

function buildDayLookup() {
  const lookup = new Map<string, number>()

  ;[...DAY_ALIASES, ...WEEKDAY_ORDER_ALIASES].forEach(([day, aliases]) => {
    aliases.forEach((alias) => {
      const normalizedAlias = normalizeDayLookup(alias)

      lookup.set(normalizedAlias.spaced, day)

      if (normalizedAlias.compact) {
        lookup.set(normalizedAlias.compact, day)
      }
    })
  })

  return lookup
}

const DAY_LOOKUP = buildDayLookup()

function isEmptyRow(row: RawCell[]) {
  return row.every((cell) => normalizeText(cell) === "")
}

function resolveProgramField(cell: unknown) {
  const normalized = normalizeKey(cell)

  return (Object.entries(PROGRAM_FIELD_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] ??
    undefined) as ProgramFieldKey | undefined
}

function resolveWorkoutColumn(cell: unknown) {
  const normalized = normalizeKey(cell)

  return (Object.entries(WORKOUT_COLUMN_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] ??
    undefined) as WorkoutColumnKey | undefined
}

function parsePositiveInteger(value: string) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return undefined
  }

  const normalizedValue = Math.round(parsedValue)

  return normalizedValue > 0 ? normalizedValue : undefined
}

function parseScheduledDay(value: string) {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return undefined
  }

  const parsedNumericValue = Number(normalizedValue)

  if (Number.isFinite(parsedNumericValue)) {
    const roundedValue = Math.round(parsedNumericValue)

    if (roundedValue === 7) {
      return 0
    }

    if (roundedValue >= 0 && roundedValue <= 6) {
      return roundedValue
    }
  }

  const normalizedDay = normalizeDayLookup(normalizedValue)
  const mappedDay = DAY_LOOKUP.get(normalizedDay.spaced) ?? DAY_LOOKUP.get(normalizedDay.compact)

  if (mappedDay != null) {
    return mappedDay
  }

  const isoDateMatch = normalizedDay.spaced.match(/^(\d{4})[ /-](\d{1,2})[ /-](\d{1,2})$/)

  if (isoDateMatch) {
    const parsedDate = new Date(Date.UTC(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3])))
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.getUTCDay()
  }

  const dmyDateMatch = normalizedDay.spaced.match(/^(\d{1,2})[ /-](\d{1,2})[ /-](\d{2,4})$/)

  if (dmyDateMatch) {
    const year = Number(dmyDateMatch[3].length === 2 ? `20${dmyDateMatch[3]}` : dmyDateMatch[3])
    const parsedDate = new Date(Date.UTC(year, Number(dmyDateMatch[2]) - 1, Number(dmyDateMatch[1])))
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.getUTCDay()
  }

  return undefined
}

function buildVariationLookup(exercises: ExerciseVariationOption[]) {
  const byExerciseAndVariation = new Map<string, ExerciseVariationOption>()
  const byExerciseName = new Map<string, ExerciseVariationOption[]>()
  const byId = new Map<string, ExerciseVariationOption>()

  exercises.forEach((exercise) => {
    const exerciseNameKey = normalizeLookup(exercise.exerciseName)
    const variationKey = `${exerciseNameKey}::${normalizeLookup(exercise.variationName)}`

    byId.set(exercise.id, exercise)
    byExerciseAndVariation.set(variationKey, exercise)
    byExerciseName.set(exerciseNameKey, [...(byExerciseName.get(exerciseNameKey) ?? []), exercise])
  })

  return {
    byExerciseAndVariation,
    byExerciseName,
    byId,
  }
}

function resolveVariation(
  lookup: ReturnType<typeof buildVariationLookup>,
  row: {
    exerciseName: string
    variationId: string
    variationName: string
  },
) {
  if (row.variationId) {
    return lookup.byId.get(row.variationId)
  }

  if (row.exerciseName && row.variationName) {
    return lookup.byExerciseAndVariation.get(
      `${normalizeLookup(row.exerciseName)}::${normalizeLookup(row.variationName)}`,
    )
  }

  if (row.exerciseName) {
    const matches = lookup.byExerciseName.get(normalizeLookup(row.exerciseName)) ?? []

    if (matches.length === 1) {
      return matches[0]
    }

    const defaultMatch = matches.find((exercise) => exercise.isDefault)

    if (defaultMatch) {
      return defaultMatch
    }
  }

  return undefined
}

type SampleWorkoutSlot = {
  keywords: string[]
  muscleGroups: string[]
  repsRange: string
  sets: number
  weight?: number
}

type SampleWorkoutPlan = {
  name: string
  scheduledDay: string
  slots: SampleWorkoutSlot[]
}

const SAMPLE_WORKOUT_PLANS: SampleWorkoutPlan[] = [
  {
    name: "Upper A",
    scheduledDay: "Monday",
    slots: [
      { keywords: ["bench", "chest press", "incline"], muscleGroups: ["Chest"], repsRange: "6-8", sets: 4, weight: 40 },
      { keywords: ["row", "pulldown", "pull up"], muscleGroups: ["Back"], repsRange: "8-10", sets: 4, weight: 35 },
      {
        keywords: ["shoulder press", "overhead press", "lateral raise"],
        muscleGroups: ["Shoulders"],
        repsRange: "10-12",
        sets: 3,
        weight: 20,
      },
    ],
  },
  {
    name: "Lower A",
    scheduledDay: "Tuesday",
    slots: [
      { keywords: ["squat", "leg press", "hack squat"], muscleGroups: ["Legs"], repsRange: "6-8", sets: 4, weight: 60 },
      { keywords: ["romanian", "rdl", "deadlift", "leg curl"], muscleGroups: ["Legs", "Back"], repsRange: "8-10", sets: 3, weight: 50 },
      { keywords: ["split squat", "lunge", "leg extension", "calf"], muscleGroups: ["Legs"], repsRange: "10-12", sets: 3, weight: 20 },
    ],
  },
  {
    name: "Upper B",
    scheduledDay: "Thursday",
    slots: [
      { keywords: ["incline", "bench", "dip", "chest press"], muscleGroups: ["Chest"], repsRange: "8-10", sets: 4, weight: 35 },
      { keywords: ["lat pulldown", "pull down", "row", "pull up"], muscleGroups: ["Back"], repsRange: "10-12", sets: 4, weight: 30 },
      { keywords: ["curl", "tricep", "pushdown", "extension"], muscleGroups: ["Arms"], repsRange: "12-15", sets: 3, weight: 12.5 },
    ],
  },
  {
    name: "Lower B",
    scheduledDay: "Saturday",
    slots: [
      { keywords: ["deadlift", "squat", "leg press"], muscleGroups: ["Legs", "Back"], repsRange: "5-6", sets: 4, weight: 70 },
      { keywords: ["hip thrust", "glute", "lunge", "split squat"], muscleGroups: ["Legs"], repsRange: "8-10", sets: 3, weight: 40 },
      { keywords: ["calf", "leg curl", "leg extension"], muscleGroups: ["Legs"], repsRange: "12-15", sets: 3, weight: 20 },
    ],
  },
]

function normalizeSearchText(value: string) {
  return normalizeDayLookup(value).compact
}

function scoreSampleExercise(
  exercise: ExerciseVariationOption,
  slot: SampleWorkoutSlot,
  usedVariationIds: Set<string>,
) {
  const exerciseName = normalizeSearchText(exercise.exerciseName)
  const variationName = normalizeSearchText(exercise.variationName)
  const displayName = normalizeSearchText(exercise.name)
  const keywordMatches = slot.keywords.filter((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword)
    return exerciseName.includes(normalizedKeyword) || variationName.includes(normalizedKeyword) || displayName.includes(normalizedKeyword)
  }).length
  const muscleGroupMatch = slot.muscleGroups.some(
    (muscleGroup) => normalizeSearchText(exercise.muscleGroup) === normalizeSearchText(muscleGroup),
  )

  return (
    (usedVariationIds.has(exercise.id) ? 0 : 1000) +
    keywordMatches * 100 +
    (muscleGroupMatch ? 40 : 0) +
    (exercise.isDefault ? 10 : 0) -
    exercise.sortOrder
  )
}

function selectSampleExercise(
  exercises: ExerciseVariationOption[],
  slot: SampleWorkoutSlot,
  usedVariationIds: Set<string>,
) {
  if (exercises.length === 0) {
    return undefined
  }

  return exercises
    .slice()
    .sort((left, right) => scoreSampleExercise(right, slot, usedVariationIds) - scoreSampleExercise(left, slot, usedVariationIds))[0]
}

function buildSampleProgramRows(_trainees: CoachTrainee[]) {
  return [
    ["field", "value"],
    ["name", "Sample 4-Day Strength Program"],
    ["description", "Sample schedule generated from your current exercise library. Replace or duplicate rows before importing."],
    ["duration_weeks", "8"],
    ["difficulty", "intermediate"],
    ["assign_to_emails", ""],
  ]
}

function buildSampleWorkoutRows(exercises: ExerciseVariationOption[]) {
  const usedVariationIds = new Set<string>()
  const rows: RawCell[][] = [Array.from(WORKOUT_HEADERS)]

  SAMPLE_WORKOUT_PLANS.forEach((workoutPlan) => {
    workoutPlan.slots.forEach((slot) => {
      const selectedExercise = selectSampleExercise(exercises, slot, usedVariationIds)

      if (!selectedExercise) {
        return
      }

      usedVariationIds.add(selectedExercise.id)
      rows.push([
        workoutPlan.name,
        workoutPlan.scheduledDay,
        selectedExercise.exerciseName,
        selectedExercise.variationName,
        selectedExercise.id,
        slot.sets,
        slot.repsRange,
        slot.weight ?? "",
      ])
    })
  })

  return rows
}

async function getSheetRows(sheet: unknown) {
  const XLSX = await import("xlsx")

  return XLSX.utils.sheet_to_json<RawCell[]>(sheet as Parameters<typeof XLSX.utils.sheet_to_json>[0], {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false,
  })
}

async function findSheetByHeader(
  workbook: { SheetNames: string[]; Sheets: Record<string, unknown> },
  preferredName: string,
  resolveColumn: (cell: unknown) => string | undefined,
  requiredColumns: string[],
) {
  const preferredSheet = workbook.SheetNames.find(
    (sheetName) => normalizeLookup(sheetName) === normalizeLookup(preferredName),
  )

  if (preferredSheet) {
    return {
      rows: await getSheetRows(workbook.Sheets[preferredSheet]),
      sheetName: preferredSheet,
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const rows = await getSheetRows(workbook.Sheets[sheetName])
    const headerRow = rows[0] ?? []
    const resolvedColumns = headerRow.map(resolveColumn).filter(Boolean)

    if (requiredColumns.every((column) => resolvedColumns.includes(column))) {
      return {
        rows,
        sheetName,
      }
    }
  }

  return null
}

function parseProgramSheet(
  rows: RawCell[][],
  trainees: CoachTrainee[],
) {
  if (!rows.length) {
    return {}
  }

  const headerRow = rows[0] ?? []
  const fieldColumnIndex = headerRow.findIndex((cell) => normalizeKey(cell) === "field")
  const valueColumnIndex = headerRow.findIndex((cell) => normalizeKey(cell) === "value")

  if (fieldColumnIndex < 0 || valueColumnIndex < 0) {
    throw new Error("Sheet Program phải có cột 'field' và 'value'.")
  }

  const rawValues = rows.slice(1).reduce<Partial<Record<ProgramFieldKey, string>>>((result, row) => {
    if (isEmptyRow(row)) {
      return result
    }

    const field = resolveProgramField(row[fieldColumnIndex])
    const value = normalizeText(row[valueColumnIndex])

    if (field && value) {
      result[field] = value
    }

    return result
  }, {})

  const draft: ImportedProgramDraft = {
    workouts: [],
  }

  if (rawValues.name) {
    draft.name = rawValues.name
  }

  if (rawValues.description) {
    draft.description = rawValues.description
  }

  if (rawValues.duration) {
    const duration = parsePositiveInteger(rawValues.duration)

    if (!duration) {
      throw new Error("Giá trị duration_weeks trong sheet Program không hợp lệ.")
    }

    draft.duration = duration
  }

  if (rawValues.difficulty) {
    const difficulty = DIFFICULTY_MAP.get(normalizeLookup(rawValues.difficulty))

    if (!difficulty) {
      throw new Error("Giá trị difficulty trong sheet Program phải là beginner, intermediate hoặc advanced.")
    }

    draft.difficulty = difficulty
  }

  if (rawValues.assignToEmails) {
    const emails = Array.from(
      new Set(
        rawValues.assignToEmails
          .split(/[;,\n]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    )
    const traineeIdByEmail = new Map(
      trainees
        .filter((trainee) => trainee.email)
        .map((trainee) => [trainee.email.trim().toLowerCase(), trainee.id] as const),
    )
    const missingEmails = emails.filter((email) => !traineeIdByEmail.has(email))

    if (missingEmails.length > 0) {
      throw new Error(`Không tìm thấy trainee theo email: ${missingEmails.join(", ")}.`)
    }

    draft.assignToUserIds = emails.map((email) => traineeIdByEmail.get(email) as string)
  }

  return draft
}

function parseWorkoutRows(
  rows: RawCell[][],
  exercises: ExerciseVariationOption[],
) {
  if (!rows.length) {
    throw new Error("Sheet Workouts đang trống.")
  }

  const headerRow = rows[0] ?? []
  const columnMap = headerRow.reduce<Partial<Record<WorkoutColumnKey, number>>>((result, cell, index) => {
    const column = resolveWorkoutColumn(cell)

    if (column && typeof result[column] !== "number") {
      result[column] = index
    }

    return result
  }, {})

  const requiredColumns: WorkoutColumnKey[] = ["workoutName", "scheduledDay", "sets", "reps"]
  const missingColumns = requiredColumns.filter((column) => typeof columnMap[column] !== "number")

  if (missingColumns.length > 0) {
    const missingColumnLabels = missingColumns.map((column) => (column === "reps" ? "reps_range" : column))
    throw new Error(`Sheet Workouts thiếu cột bắt buộc: ${missingColumnLabels.join(", ")}.`)
  }

  const variationLookup = buildVariationLookup(exercises)
  const groupedWorkouts = new Map<
    string,
    {
      exercises: CreateCoachProgramInput["workouts"][number]["exercises"]
      name: string
      scheduledDay: number
    }
  >()
  const issues: string[] = []
  let lastScheduledDayRaw = ""
  let lastWorkoutName = ""

  function findNextScheduledDayValue(startIndex: number) {
    for (let index = startIndex + 1; index < rows.length; index += 1) {
      const nextValue = normalizeText(rows[index]?.[columnMap.scheduledDay as number])

      if (nextValue) {
        return nextValue
      }
    }

    return ""
  }

  rows.slice(1).forEach((row, rowIndex) => {
    if (isEmptyRow(row)) {
      return
    }

    const workoutNameRaw = normalizeText(row[columnMap.workoutName as number])
    const scheduledDayCellRaw = normalizeText(row[columnMap.scheduledDay as number])
    const workoutName = workoutNameRaw || lastWorkoutName
    const scheduledDayCandidates = [
      scheduledDayCellRaw,
      lastScheduledDayRaw,
      findNextScheduledDayValue(rowIndex + 1),
      workoutNameRaw,
      workoutName,
    ].filter(Boolean)
    const scheduledDayRaw = scheduledDayCandidates[0] ?? ""
    const setsRaw = normalizeText(row[columnMap.sets as number])
    const repsRaw = normalizeText(row[columnMap.reps as number])
    const variationId = normalizeText(
      typeof columnMap.variationId === "number" ? row[columnMap.variationId] : "",
    )
    const exerciseName = normalizeText(
      typeof columnMap.exerciseName === "number" ? row[columnMap.exerciseName] : "",
    )
    const variationName = normalizeText(
      typeof columnMap.variationName === "number" ? row[columnMap.variationName] : "",
    )
    const scheduledDay = scheduledDayCandidates
      .map((candidate) => parseScheduledDay(candidate))
      .find((candidate): candidate is number => candidate != null)
    const sets = parsePositiveInteger(setsRaw)
    const repTarget = parseRepTargetText(repsRaw)
    const rowNumber = rowIndex + 2

    if (workoutNameRaw) {
      lastWorkoutName = workoutNameRaw
    }

    if (scheduledDayCellRaw) {
      lastScheduledDayRaw = scheduledDayCellRaw
    }

    if (!workoutName) {
      issues.push(`Dòng ${rowNumber}: thiếu workout_name.`)
      return
    }

    if (scheduledDay == null) {
      issues.push(
        `Dòng ${rowNumber}: scheduled_day '${scheduledDayRaw || "(trống)"}' không hợp lệ. Dùng 0-6, 7, Monday, T2, Thu2, Thứ hai, CN hoặc Day 1-Day 7.`,
      )
      return
    }

    if (!sets) {
      issues.push(`Dòng ${rowNumber}: sets phải là số nguyên dương.`)
      return
    }

    if (!repTarget) {
      issues.push(`Dòng ${rowNumber}: reps_range phải là số nguyên dương hoặc khoảng như 8-12.`)
      return
    }

    if (!variationId && !exerciseName) {
      issues.push(`Dòng ${rowNumber}: cần variation_id hoặc exercise_name.`)
      return
    }

    const variation = resolveVariation(variationLookup, {
      exerciseName,
      variationId,
      variationName,
    })

    if (!variation) {
      issues.push(
        `Dòng ${rowNumber}: không map được variation cho '${variationId || `${exerciseName} / ${variationName || "Default"}`}'.`,
      )
      return
    }

    const weightRaw = normalizeText(typeof columnMap.weight === "number" ? row[columnMap.weight] : "")
    const parsedWeight = Number(weightRaw)
    const key = `${workoutName}::${scheduledDay}`
    const workout = groupedWorkouts.get(key) ?? {
      exercises: [],
      name: workoutName,
      scheduledDay,
    }

    workout.exercises.push({
      reps: repTarget.reps,
      repsMin: repTarget.repsMin,
      sets,
      variationId: variation.id,
      weight: weightRaw && Number.isFinite(parsedWeight) ? Math.max(0, parsedWeight) : undefined,
    })

    groupedWorkouts.set(key, workout)
  })

  if (issues.length > 0) {
    throw new Error(issues.slice(0, 8).join(" "))
  }

  return Array.from(groupedWorkouts.values())
}

async function importCoachProgramTemplate(
  file: File,
  exercises: ExerciseVariationOption[],
  trainees: CoachTrainee[],
): Promise<ImportedProgramDraft> {
  const XLSX = await import("xlsx")
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: "array",
  })

  if (!workbook.SheetNames.length) {
    throw new Error("File Excel không có sheet nào.")
  }

  const programSheet = await findSheetByHeader(
    workbook,
    PROGRAM_SHEET_NAME,
    resolveProgramField,
    ["name"],
  )
  const workoutsSheet = await findSheetByHeader(
    workbook,
    WORKOUTS_SHEET_NAME,
    resolveWorkoutColumn,
    ["reps", "scheduledDay", "sets", "workoutName"],
  )

  if (!workoutsSheet) {
    throw new Error("Không tìm thấy sheet Workouts hợp lệ trong file import.")
  }

  const programDraft = programSheet ? parseProgramSheet(programSheet.rows, trainees) : { workouts: [] }
  const workouts = parseWorkoutRows(workoutsSheet.rows, exercises)

  if (workouts.length === 0) {
    throw new Error("File import chưa có workout hợp lệ nào.")
  }

  return {
    ...programDraft,
    workouts,
  }
}

async function downloadCoachProgramTemplate(
  exercises: ExerciseVariationOption[],
  trainees: CoachTrainee[],
) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()
  const sampleProgramRows = buildSampleProgramRows(trainees)
  const sampleWorkoutRows = buildSampleWorkoutRows(exercises)
  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["Coach program import template"],
    ["1. This workbook already includes a ready-to-import sample schedule."],
    ["2. Edit the Program sheet for metadata and trainee assignment before importing."],
    ["3. The Workouts sheet is prefilled with sample rows based on your current exercise library."],
    ["4. Each row in Workouts is one exercise inside one workout day."],
    ["5. scheduled_day accepts 0-6, 7, English day names, Vietnamese aliases like T2/CN, and Day 1-Day 7."],
    ["6. reps_range accepts a single target like 10 or a range like 8-12."],
    ["7. variation_id is already filled for reliability. Keep it unless you intentionally change the exercise."],
    ["8. assign_to_emails is optional. Use emails from the Trainees sheet if you want to assign the program on save."],
  ])
  const programSheet = XLSX.utils.aoa_to_sheet(sampleProgramRows)
  const workoutsSheet = XLSX.utils.aoa_to_sheet(sampleWorkoutRows)
  const referenceSheet = XLSX.utils.aoa_to_sheet([
    ["variation_id", "exercise_name", "variation_name", "display_name", "muscle_group", "equipment"],
    ...exercises.map((exercise) => [
      exercise.id,
      exercise.exerciseName,
      exercise.variationName,
      exercise.name,
      exercise.muscleGroup,
      exercise.equipment ?? "",
    ]),
  ])
  const traineesSheet = XLSX.utils.aoa_to_sheet([
    ["trainee_name", "email"],
    ...trainees.map((trainee) => [trainee.name, trainee.email]),
  ])

  instructionsSheet["!cols"] = [{ wch: 110 }]
  programSheet["!cols"] = [{ wch: 22 }, { wch: 70 }]
  workoutsSheet["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
    { wch: 40 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ]
  referenceSheet["!cols"] = [{ wch: 40 }, { wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 18 }]
  traineesSheet["!cols"] = [{ wch: 28 }, { wch: 34 }]

  // Freeze panes
  // Program: freeze cột "field" (col A) + header row
  programSheet["!views"] = [{ state: "frozen", xSplit: 1, ySplit: 1 }]
  // Workouts: freeze 2 cột đầu (workout_name, scheduled_day) + header row
  workoutsSheet["!views"] = [{ state: "frozen", xSplit: 2, ySplit: 1 }]
  // Reference: freeze 2 cột đầu (variation_id, exercise_name) + header row
  referenceSheet["!views"] = [{ state: "frozen", xSplit: 2, ySplit: 1 }]
  // Trainees: freeze header row
  traineesSheet["!views"] = [{ state: "frozen", ySplit: 1 }]

  XLSX.utils.book_append_sheet(workbook, programSheet, PROGRAM_SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, workoutsSheet, WORKOUTS_SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, INSTRUCTIONS_SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, referenceSheet, REFERENCE_SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, traineesSheet, TRAINEES_SHEET_NAME)

  XLSX.writeFile(workbook, "coach-program-template.xlsx")
}

export { downloadCoachProgramTemplate, importCoachProgramTemplate }
export type { ImportedProgramDraft }
