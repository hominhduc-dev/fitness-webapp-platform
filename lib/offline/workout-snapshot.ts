import { getOfflineDatabase } from "@/lib/offline/db"
import type { Workout } from "@/lib/types"

const MAX_SNAPSHOTS_PER_USER = 8

function snapshotId(userId: string, workoutId: string) {
  return `workout:${userId}:${workoutId}`
}

/**
 * Stores the complete logger seed separately from the mutation queue. Session
 * drafts intentionally contain only changing set values; this snapshot keeps
 * exercise names, variations and targets available after an offline restart.
 */
export async function saveOfflineWorkoutSnapshot(userId: string, workout: Workout) {
  const database = await getOfflineDatabase()
  const transaction = database.transaction("workoutSnapshots", "readwrite")
  await transaction.store.put({
    cachedAt: Date.now(),
    id: snapshotId(userId, workout.id),
    userId,
    workout,
    workoutId: workout.id,
  })

  const snapshots = await transaction.store.index("by-user").getAll(userId)
  const excess = snapshots
    .sort((left, right) => right.cachedAt - left.cachedAt)
    .slice(MAX_SNAPSHOTS_PER_USER)
  await Promise.all(excess.map((snapshot) => transaction.store.delete(snapshot.id)))
  await transaction.done
}

export async function getOfflineWorkoutSnapshot(userId: string, workoutId: string): Promise<Workout | null> {
  const database = await getOfflineDatabase()
  return (await database.get("workoutSnapshots", snapshotId(userId, workoutId)))?.workout ?? null
}

export async function deleteOfflineWorkoutSnapshot(userId: string, workoutId: string) {
  const database = await getOfflineDatabase()
  await database.delete("workoutSnapshots", snapshotId(userId, workoutId))
}

/** Full workout metadata is private and must not survive an account change. */
export async function clearOfflineWorkoutSnapshots() {
  const database = await getOfflineDatabase()
  await database.clear("workoutSnapshots")
}
