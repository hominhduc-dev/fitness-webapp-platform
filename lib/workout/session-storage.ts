export const WORKOUT_SESSION_STORAGE_PREFIX = "workout-session"
export const WORKOUT_SESSION_STORAGE_SCHEMA_VERSION = 5

export type StoredCompoundSetType = "drop_set" | "rest_pause" | "myo_rep_match" | "cluster"

export type StoredCompoundSetSegment = {
  id: string
  reps?: number
  weight?: number
}

export type StoredCompoundSet = {
  restSec?: number
  segments: StoredCompoundSetSegment[]
  targetReps?: number
  type: StoredCompoundSetType
}

export type StoredWorkoutSessionSet = {
  actualReps?: number
  addedDuringSession?: boolean
  clientAddedToken?: string
  compoundSet?: StoredCompoundSet
  completed: boolean
  id: string
  notes?: string
  rir?: number
  weight?: number
}

export type StoredWorkoutSessionExercise = {
  id: string
  sets: StoredWorkoutSessionSet[]
}

export type StoredWorkoutSession = {
  currentExerciseIndex: number
  exercises: StoredWorkoutSessionExercise[]
  schemaVersion?: number
  startedAt: string
  workoutName?: string
}

export function getWorkoutSessionStorageKey(workoutId: string) {
  return `${WORKOUT_SESSION_STORAGE_PREFIX}:${workoutId}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function sanitizeCompoundSet(rawCompoundSet: unknown): StoredCompoundSet | undefined {
  if (typeof rawCompoundSet !== "object" || rawCompoundSet === null) return undefined
  const compoundRecord = rawCompoundSet as {
    restSec?: unknown
    segments?: unknown
    targetReps?: unknown
    type?: unknown
  }
  if (
    compoundRecord.type !== "drop_set" &&
    compoundRecord.type !== "rest_pause" &&
    compoundRecord.type !== "myo_rep_match" &&
    compoundRecord.type !== "cluster"
  ) {
    return undefined
  }

  const rawSegments = Array.isArray(compoundRecord.segments) ? compoundRecord.segments : []
  const segments = rawSegments.flatMap((segment: unknown) => {
    if (typeof segment !== "object" || segment === null) return []
    const segmentRecord = segment as { id?: unknown; reps?: unknown; weight?: unknown }
    if (typeof segmentRecord.id !== "string") return []
    return [
      {
        id: segmentRecord.id,
        reps: isFiniteNumber(segmentRecord.reps) ? segmentRecord.reps : undefined,
        weight: isFiniteNumber(segmentRecord.weight) ? segmentRecord.weight : undefined,
      },
    ]
  })

  return {
    restSec: isFiniteNumber(compoundRecord.restSec) ? compoundRecord.restSec : undefined,
    segments,
    targetReps: isFiniteNumber(compoundRecord.targetReps) ? compoundRecord.targetReps : undefined,
    type: compoundRecord.type,
  }
}

function sanitizeStoredWorkoutExercises(rawExercises: unknown): StoredWorkoutSessionExercise[] {
  if (!Array.isArray(rawExercises)) return []

  return rawExercises.flatMap((exercise: unknown) => {
    if (typeof exercise !== "object" || exercise === null) return []
    const exerciseRecord = exercise as { id?: unknown; sets?: unknown }
    if (typeof exerciseRecord.id !== "string") return []
    const rawSets = Array.isArray(exerciseRecord.sets) ? exerciseRecord.sets : []
    return [
      {
        id: exerciseRecord.id,
        sets: rawSets.flatMap((set: unknown) => {
          if (typeof set !== "object" || set === null) return []
          const setRecord = set as {
            actualReps?: unknown
            addedDuringSession?: unknown
            clientAddedToken?: unknown
            compoundSet?: unknown
            completed?: unknown
            id?: unknown
            notes?: unknown
            rir?: unknown
            weight?: unknown
          }
          if (typeof setRecord.id !== "string") return []
          return [
            {
              actualReps: isFiniteNumber(setRecord.actualReps) ? setRecord.actualReps : undefined,
              addedDuringSession: setRecord.addedDuringSession === true,
              clientAddedToken: typeof setRecord.clientAddedToken === "string" ? setRecord.clientAddedToken : undefined,
              compoundSet: sanitizeCompoundSet(setRecord.compoundSet),
              completed: Boolean(setRecord.completed),
              id: setRecord.id,
              notes: typeof setRecord.notes === "string" ? setRecord.notes : undefined,
              rir: isFiniteNumber(setRecord.rir) ? setRecord.rir : undefined,
              weight: isFiniteNumber(setRecord.weight) ? setRecord.weight : undefined,
            },
          ]
        }),
      },
    ]
  })
}

export function readStoredWorkoutSession(workoutId: string): StoredWorkoutSession | null {
  if (typeof window === "undefined") return null
  const key = getWorkoutSessionStorageKey(workoutId)
  const rawValue = window.localStorage.getItem(key)
  if (!rawValue) return null
  try {
    const parsed = JSON.parse(rawValue)
    if (typeof parsed !== "object" || parsed === null) {
      window.localStorage.removeItem(key)
      return null
    }
    const currentExerciseIndex = isFiniteNumber(parsed.currentExerciseIndex) ? parsed.currentExerciseIndex : 0
    const schemaVersion = isFiniteNumber(parsed.schemaVersion) ? parsed.schemaVersion : undefined
    const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString()
    const workoutName = typeof parsed.workoutName === "string" ? parsed.workoutName : undefined
    const exercises = sanitizeStoredWorkoutExercises(parsed.exercises)
    return { currentExerciseIndex, exercises, schemaVersion, startedAt, workoutName }
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function clearStoredWorkoutSession(workoutId: string) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(getWorkoutSessionStorageKey(workoutId))
}

export function storedSessionHasProgress(exercises: StoredWorkoutSessionExercise[]): boolean {
  return exercises.some((exercise) =>
    exercise.sets.some(
      (set) =>
        set.completed ||
        set.compoundSet != null ||
        set.weight != null ||
        set.actualReps != null ||
        (typeof set.notes === "string" && set.notes.trim().length > 0) ||
        set.rir != null,
    ),
  )
}

export type ActiveWorkoutSession = {
  completedSets: number
  startedAt: string
  totalSets: number
  workoutId: string
  workoutName?: string
}

/**
 * Scan every `workout-session:*` key in localStorage, return sessions that
 * have real progress, sorted by `startedAt` (newest first).
 */
export function scanActiveSessions(): ActiveWorkoutSession[] {
  if (typeof window === "undefined") return []
  const results: ActiveWorkoutSession[] = []

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key || !key.startsWith(`${WORKOUT_SESSION_STORAGE_PREFIX}:`)) continue
    const workoutId = key.slice(WORKOUT_SESSION_STORAGE_PREFIX.length + 1)
    if (!workoutId) continue

    const session = readStoredWorkoutSession(workoutId)
    if (!session || !storedSessionHasProgress(session.exercises)) continue

    const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
    const completedSets = session.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0,
    )

    results.push({
      completedSets,
      startedAt: session.startedAt,
      totalSets,
      workoutId,
      workoutName: session.workoutName,
    })
  }

  results.sort((a, b) => {
    const timeA = Date.parse(a.startedAt) || 0
    const timeB = Date.parse(b.startedAt) || 0
    return timeB - timeA
  })

  return results
}
