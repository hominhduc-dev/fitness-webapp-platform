import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { WorkoutLogInput } from "@/lib/fitness/types"
import type { StoredWorkoutSession } from "@/lib/workout/session-storage"

export type OfflineMutationStatus = "pending" | "failed"

type OfflineMutationBase = {
  attempts: number
  createdAt: number
  id: string
  lastError: string | null
  /** Replay order. Coalescing a record re-stamps it, moving it to the back. */
  sequence: number
  status: OfflineMutationStatus
  userId: string
  workoutId: string
}

/**
 * Everything written while the network is unreliable. A record is the unit of
 * sync: it is deleted once the server has accepted it, so the store doubles as
 * the list of what has not reached the server yet.
 */
export type OfflineMutation =
  | OfflineMutationBase & {
      /** Completed sets of a finished workout — the data that must never be lost. */
      payload: WorkoutLogInput & { clientLogId: string }
      type: "workout-log.create"
      workoutName?: string
    }
  | OfflineMutationBase & {
      /** Latest in-progress session; one record per workout, newest wins. */
      payload: StoredWorkoutSession
      type: "workout-session-draft.upsert"
    }
  | OfflineMutationBase & {
      payload: null
      type: "workout-session-draft.delete"
    }

interface OfflineDatabase extends DBSchema {
  mutations: {
    indexes: { "by-user": string }
    key: string
    value: OfflineMutation
  }
}

const DATABASE_NAME = "yeahbuddy-offline"
const DATABASE_VERSION = 1

let databasePromise: Promise<IDBPDatabase<OfflineDatabase>> | null = null

export function isOfflineStorageAvailable() {
  return typeof indexedDB !== "undefined"
}

export function getOfflineDatabase() {
  databasePromise ??= openDB<OfflineDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      const mutations = database.createObjectStore("mutations", { keyPath: "id" })
      mutations.createIndex("by-user", "userId")
    },
    // Another tab upgraded the schema: let it proceed and reopen lazily.
    blocking() {
      void databasePromise?.then((database) => database.close())
      databasePromise = null
    },
  }).catch((error: unknown) => {
    databasePromise = null
    throw error
  })

  return databasePromise
}

/** Test-only: forget the open handle so a fresh fake IndexedDB can be used. */
export function resetOfflineDatabaseForTests() {
  databasePromise = null
}
