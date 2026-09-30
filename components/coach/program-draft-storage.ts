import type { CoachProgram } from "@/lib/fitness/types"
import type { SetIntensityAssignment } from "@/lib/workout/intensity-tag"
import type { RoutineDraftData, RoutineExerciseDraft } from "@/components/workout/routine-builder-dialog"

export type RoutineTag = "push" | "pull" | "legs" | "upper" | "lower" | "full"

export type RoutineExercise = {
  fallbackEquipment?: string
  fallbackExerciseName?: string
  fallbackIsDefault?: boolean
  fallbackMuscleGroup?: string
  fallbackVariationName?: string
  id: string
  rir?: number | string
  reps: string
  restTime?: string
  setIntensityTags?: SetIntensityAssignment[]
  sets: number
  variationId: string
  weight: string
}

export type Routine = {
  exercises: RoutineExercise[]
  id: string
  name: string
  tag: RoutineTag
}

export type ScheduleSlot = {
  routine: Routine | null
} | null

export type Schedule = ScheduleSlot[][]

/** Every field of the program editor that "Save" sends to the server. */
export type ProgramDraftForm = {
  description: string
  difficulty: CoachProgram["difficulty"]
  duration: string
  programGoal: string
  programName: string
  routineLibrary: Routine[]
  schedule: Schedule
  selectedTraineeIds: string[]
  startDate: string
}

/**
 * The coach's unsaved work on one program. The editor keeps everything in
 * memory until "Save", so without this copy closing the editor, reloading or
 * leaving the page dropped every edit.
 */
export type StoredProgramDraft = {
  form: ProgramDraftForm
  /**
   * A session (day) the coach edited in the routine dialog but closed without
   * pressing its save, keyed by `getRoutineDraftKey`. Reopening that session
   * shows these fields instead of the saved ones.
   */
  routineDrafts: Record<string, RoutineDraftData>
  savedAt: string
  schemaVersion: number
  /**
   * Fingerprint of the server program the draft was edited from. A draft whose
   * program was saved again since (another tab or device) is not restored
   * silently over the newer version.
   */
  serverVersion: string
}

export const PROGRAM_DRAFT_STORAGE_PREFIX = "coach-program-draft"
export const PROGRAM_DRAFT_SCHEMA_VERSION = 1
export const NEW_PROGRAM_SERVER_VERSION = "new"

const ROUTINE_TAGS: readonly RoutineTag[] = ["push", "pull", "legs", "upper", "lower", "full"]
const DIFFICULTIES: readonly CoachProgram["difficulty"][] = ["beginner", "intermediate", "advanced"]

/** Scoped per coach, so a shared browser never shows one coach's draft to another. */
export function getProgramDraftStorageKey(userId: string, programId?: string, adjustTraineeId?: string) {
  return `${PROGRAM_DRAFT_STORAGE_PREFIX}:${userId}:${programId ?? "new"}:${adjustTraineeId ?? ""}`
}

/** A session edited from a slot and from the library share the routine id, and so one draft. */
export function getRoutineDraftKey(routineId: string | undefined) {
  return routineId ? `routine:${routineId}` : "create"
}

/** JSON with object keys sorted, so two equal values always serialize the same. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, current: unknown) =>
    current && typeof current === "object" && !Array.isArray(current)
      ? Object.fromEntries(Object.entries(current as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : current,
  ) ?? ""
}

/** FNV-1a over the program's stable JSON; only compared for equality. */
export function getProgramServerVersion(program: unknown) {
  const text = stableStringify(program)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`
}

/** Whether the dialog's fields still match the session they were opened from. */
export function isSameRoutineDraft(a: RoutineDraftData, b: RoutineDraftData) {
  return (
    stableStringify({ exercises: a.exercises, name: a.name, tag: a.tag }) ===
    stableStringify({ exercises: b.exercises, name: b.name, tag: b.tag })
  )
}

/** Routine drafts of sessions that no longer exist in the program are dropped. */
export function pruneRoutineDrafts(form: ProgramDraftForm, routineDrafts: Record<string, RoutineDraftData>) {
  const routineIds = new Set(form.routineLibrary.map((routine) => routine.id))
  for (const week of form.schedule) {
    for (const slot of week) {
      if (slot?.routine) routineIds.add(slot.routine.id)
    }
  }

  return Object.fromEntries(
    Object.entries(routineDrafts).filter(([key]) => key === "create" || routineIds.has(key.slice("routine:".length))),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null
}

function readRoutineExercise(value: unknown): RoutineExercise | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.variationId !== "string") return null
  if (!isFiniteNumber(value.sets) || typeof value.reps !== "string" || typeof value.weight !== "string") return null
  return value as RoutineExercise
}

function readRoutine(value: unknown): Routine | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.name !== "string") return null
  if (!ROUTINE_TAGS.includes(value.tag as RoutineTag) || !Array.isArray(value.exercises)) return null
  const exercises = value.exercises.map(readRoutineExercise)
  if (exercises.some((exercise) => exercise === null)) return null
  return { exercises: exercises as RoutineExercise[], id: value.id, name: value.name, tag: value.tag as RoutineTag }
}

function readSchedule(value: unknown): Schedule | null {
  if (!Array.isArray(value)) return null
  const schedule: Schedule = []
  for (const week of value) {
    if (!Array.isArray(week)) return null
    const slots: ScheduleSlot[] = []
    for (const slot of week) {
      if (slot === null) {
        slots.push(null)
        continue
      }
      if (!isRecord(slot)) return null
      if (slot.routine === null) {
        slots.push({ routine: null })
        continue
      }
      const routine = readRoutine(slot.routine)
      if (!routine) return null
      slots.push({ routine })
    }
    schedule.push(slots)
  }
  return schedule
}

function readForm(value: unknown): ProgramDraftForm | null {
  if (!isRecord(value)) return null
  const stringFields = ["description", "duration", "programGoal", "programName", "startDate"] as const
  if (stringFields.some((field) => typeof value[field] !== "string")) return null
  if (!DIFFICULTIES.includes(value.difficulty as CoachProgram["difficulty"])) return null

  const schedule = readSchedule(value.schedule)
  const selectedTraineeIds = readStringArray(value.selectedTraineeIds)
  if (!schedule || !selectedTraineeIds || !Array.isArray(value.routineLibrary)) return null
  const routineLibrary = value.routineLibrary.map(readRoutine)
  if (routineLibrary.some((routine) => routine === null)) return null

  return {
    description: value.description as string,
    difficulty: value.difficulty as CoachProgram["difficulty"],
    duration: value.duration as string,
    programGoal: value.programGoal as string,
    programName: value.programName as string,
    routineLibrary: routineLibrary as Routine[],
    schedule,
    selectedTraineeIds,
    startDate: value.startDate as string,
  }
}

function readRoutineExerciseDraft(value: unknown): RoutineExerciseDraft | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.variationId !== "string" || typeof value.displayName !== "string") return null
  if (!isFiniteNumber(value.sets) || typeof value.reps !== "string" || typeof value.weight !== "string" || typeof value.rir !== "string") {
    return null
  }
  return value as RoutineExerciseDraft
}

function readRoutineDraft(value: unknown): RoutineDraftData | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== "string" || !ROUTINE_TAGS.includes(value.tag as RoutineTag) || !Array.isArray(value.exercises)) return null
  if (value.id !== undefined && typeof value.id !== "string") return null
  const exercises = value.exercises.map(readRoutineExerciseDraft)
  if (exercises.some((exercise) => exercise === null)) return null
  return {
    exercises: exercises as RoutineExerciseDraft[],
    id: value.id as string | undefined,
    name: value.name,
    tag: value.tag as RoutineTag,
  }
}

function readRoutineDrafts(value: unknown) {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, draft]) => {
      const routineDraft = readRoutineDraft(draft)
      return routineDraft ? [[key, routineDraft] as const] : []
    }),
  )
}

/** The stored draft, or null when there is none or it cannot be read back safely. */
export function readProgramDraft(key: string): StoredProgramDraft | null {
  if (typeof window === "undefined") return null
  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) return null
    const parsed: unknown = JSON.parse(rawValue)
    const form = isRecord(parsed) && parsed.schemaVersion === PROGRAM_DRAFT_SCHEMA_VERSION ? readForm(parsed.form) : null
    if (!isRecord(parsed) || !form || typeof parsed.savedAt !== "string" || typeof parsed.serverVersion !== "string") {
      window.localStorage.removeItem(key)
      return null
    }
    return {
      form,
      routineDrafts: readRoutineDrafts(parsed.routineDrafts),
      savedAt: parsed.savedAt,
      schemaVersion: PROGRAM_DRAFT_SCHEMA_VERSION,
      serverVersion: parsed.serverVersion,
    }
  } catch {
    return null
  }
}

/** Best effort: a full or blocked storage leaves the editor working without a draft. */
export function writeProgramDraft(key: string, draft: Omit<StoredProgramDraft, "schemaVersion">) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...draft, schemaVersion: PROGRAM_DRAFT_SCHEMA_VERSION }))
  } catch {
    // Quota exceeded or storage disabled.
  }
}

export function clearProgramDraft(key: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage disabled.
  }
}
