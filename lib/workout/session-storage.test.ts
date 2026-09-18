import { beforeEach, describe, expect, it } from "vitest"
import {
  type ActiveWorkoutSession,
  type StoredWorkoutSession,
  getWorkoutSessionStorageKey,
  markStoredWorkoutSessionSynced,
  pickNewerStoredWorkoutSession,
  readStoredWorkoutSession,
  reconcileActiveSessions,
} from "./session-storage"

const STARTED_AT = "2026-09-16T09:18:00.000Z"

function storeSession(workoutId: string, overrides: Partial<StoredWorkoutSession> = {}) {
  const session: StoredWorkoutSession = {
    currentExerciseIndex: 0,
    exercises: [{ id: "bench", sets: [{ id: "set-1", completed: true, weight: 60 }] }],
    schemaVersion: 6,
    startedAt: STARTED_AT,
    ...overrides,
  }
  window.localStorage.setItem(getWorkoutSessionStorageKey(workoutId), JSON.stringify(session))
}

function serverSession(workoutId: string): ActiveWorkoutSession {
  return { completedSets: 1, startedAt: STARTED_AT, totalSets: 1, workoutId }
}

describe("reconcileActiveSessions", () => {
  beforeEach(() => window.localStorage.clear())

  it("drops and clears a synced local session that the server no longer has", () => {
    storeSession("cancelled-elsewhere", { syncedAt: "2026-09-16T09:20:00.000Z" })

    expect(reconcileActiveSessions([])).toEqual([])
    expect(readStoredWorkoutSession("cancelled-elsewhere")).toBeNull()
  })

  it("keeps a local session that never reached the server", () => {
    storeSession("offline")

    expect(reconcileActiveSessions([]).map((session) => session.workoutId)).toEqual(["offline"])
    expect(readStoredWorkoutSession("offline")).not.toBeNull()
  })

  it("keeps every local session when the server list is not authoritative", () => {
    storeSession("synced", { syncedAt: "2026-09-16T09:20:00.000Z" })

    expect(reconcileActiveSessions(null).map((session) => session.workoutId)).toEqual(["synced"])
    expect(readStoredWorkoutSession("synced")).not.toBeNull()
  })

  it("prefers the server entry over the local copy of the same workout", () => {
    storeSession("shared", { syncedAt: "2026-09-16T09:20:00.000Z" })

    expect(reconcileActiveSessions([serverSession("shared")])).toEqual([serverSession("shared")])
  })
})

describe("markStoredWorkoutSessionSynced", () => {
  beforeEach(() => window.localStorage.clear())

  it("records the sync on the same session", () => {
    storeSession("workout")
    markStoredWorkoutSessionSynced("workout", STARTED_AT, "2026-09-16T09:21:00.000Z")

    expect(readStoredWorkoutSession("workout")?.syncedAt).toBe("2026-09-16T09:21:00.000Z")
  })

  it("ignores a local copy that belongs to a different session", () => {
    storeSession("workout", { startedAt: "2026-09-17T07:00:00.000Z" })
    markStoredWorkoutSessionSynced("workout", STARTED_AT, "2026-09-16T09:21:00.000Z")

    expect(readStoredWorkoutSession("workout")?.syncedAt).toBeUndefined()
  })
})

describe("pickNewerStoredWorkoutSession", () => {
  const copy = (updatedAt: string | undefined, startedAt = STARTED_AT): StoredWorkoutSession => ({
    currentExerciseIndex: 0,
    exercises: [],
    startedAt,
    updatedAt,
  })

  it("keeps the queued draft when it is the newer write", () => {
    const queued = copy("2026-09-16T09:20:00.000Z")
    expect(pickNewerStoredWorkoutSession(queued, copy("2026-09-16T09:19:00.000Z"))).toBe(queued)
  })

  it("takes the localStorage mirror when the queued draft is a write behind", () => {
    const mirror = copy("2026-09-16T09:21:00.000Z")
    expect(pickNewerStoredWorkoutSession(copy("2026-09-16T09:20:00.000Z"), mirror)).toBe(mirror)
  })

  it("prefers a stamped copy over one written before the field existed", () => {
    const stamped = copy("2026-09-16T09:20:00.000Z")
    expect(pickNewerStoredWorkoutSession(copy(undefined), stamped)).toBe(stamped)
  })

  it("keeps the established precedence when neither copy is stamped", () => {
    const queued = copy(undefined)
    expect(pickNewerStoredWorkoutSession(queued, copy(undefined))).toBe(queued)
  })

  it("never mixes two different runs of the same workout", () => {
    const queued = copy("2026-09-16T09:20:00.000Z")
    const otherRun = copy("2026-09-17T07:30:00.000Z", "2026-09-17T07:00:00.000Z")
    expect(pickNewerStoredWorkoutSession(queued, otherRun)).toBe(queued)
  })

  it("falls back to whichever copy exists", () => {
    const only = copy("2026-09-16T09:20:00.000Z")
    expect(pickNewerStoredWorkoutSession(null, only)).toBe(only)
    expect(pickNewerStoredWorkoutSession(only, null)).toBe(only)
    expect(pickNewerStoredWorkoutSession(null, null)).toBeNull()
  })
})
