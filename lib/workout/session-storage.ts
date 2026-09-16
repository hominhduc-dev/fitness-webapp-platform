export const WORKOUT_SESSION_STORAGE_PREFIX = "workout-session"
export const WORKOUT_SESSION_STORAGE_SCHEMA_VERSION = 6

export type StoredWorkoutSessionSet = {
  actualReps?: number
  addedDuringSession?: boolean
  clientAddedToken?: string
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
  deletedSetIds?: string[]
  currentExerciseIndex: number
  exercises: StoredWorkoutSessionExercise[]
  schemaVersion?: number
  startedAt: string
  /**
   * Server `updatedAt` of the last successful draft sync. A local copy that was synced
   * but has no server draft anymore was cancelled/finished on another device; a copy
   * without it has never reached the server (offline) and must be kept.
   */
  syncedAt?: string
  workoutName?: string
}

export function getWorkoutSessionStorageKey(workoutId: string) {
  return `${WORKOUT_SESSION_STORAGE_PREFIX}:${workoutId}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
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
    const syncedAt = typeof parsed.syncedAt === "string" ? parsed.syncedAt : undefined
    const workoutName = typeof parsed.workoutName === "string" ? parsed.workoutName : undefined
    const exercises = sanitizeStoredWorkoutExercises(parsed.exercises)
    const deletedSetIds = Array.isArray(parsed.deletedSetIds)
      ? [...new Set<string>(parsed.deletedSetIds.filter((id: unknown): id is string => typeof id === "string"))]
      : []
    return { currentExerciseIndex, deletedSetIds, exercises, schemaVersion, startedAt, syncedAt, workoutName }
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function clearStoredWorkoutSession(workoutId: string) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(getWorkoutSessionStorageKey(workoutId))
}

/** Records a successful server sync on the local copy, if it still belongs to the same session. */
export function markStoredWorkoutSessionSynced(workoutId: string, startedAt: string, syncedAt: string) {
  const stored = readStoredWorkoutSession(workoutId)
  if (!stored || stored.startedAt !== startedAt) return
  window.localStorage.setItem(getWorkoutSessionStorageKey(workoutId), JSON.stringify({ ...stored, syncedAt }))
}

export function storedSessionHasProgress(exercises: StoredWorkoutSessionExercise[]): boolean {
  return exercises.some((exercise) =>
    exercise.sets.some(
      (set) =>
        set.completed ||
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
    if (!session || (!session.deletedSetIds?.length && !storedSessionHasProgress(session.exercises))) continue

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

  return sortByStartedAtDesc(results)
}

function sortByStartedAtDesc(sessions: ActiveWorkoutSession[]) {
  return sessions.sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0))
}

/**
 * Merge the server's active drafts with sessions cached in localStorage.
 *
 * Pass `serverSessions` only when it is a fresh, successful server response: local
 * copies that were synced before but are missing from it were cancelled or finished
 * on another device, so they are removed from storage instead of being shown again.
 * With `null` (offline, loading, stale) every local session is kept.
 */
export function reconcileActiveSessions(serverSessions: ActiveWorkoutSession[] | null): ActiveWorkoutSession[] {
  const localSessions = scanActiveSessions()
  if (!serverSessions) return localSessions

  const serverIds = new Set(serverSessions.map((session) => session.workoutId))
  const unsyncedLocalSessions = localSessions.filter((session) => {
    if (serverIds.has(session.workoutId)) return false
    if (!readStoredWorkoutSession(session.workoutId)?.syncedAt) return true
    clearStoredWorkoutSession(session.workoutId)
    return false
  })

  return sortByStartedAtDesc([...serverSessions, ...unsyncedLocalSessions])
}
