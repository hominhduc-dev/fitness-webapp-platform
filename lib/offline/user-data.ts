import { clearServiceWorkerUserCaches } from "@/lib/offline/service-worker"
import { clearOfflineWorkoutSnapshots } from "@/lib/offline/workout-snapshot"
import { clearPersistedQueries } from "@/lib/queries/persist"

/** Drops everything cached for offline use that belongs to the signed-in user. */
export async function clearOfflineUserData() {
  await Promise.all([
    clearServiceWorkerUserCaches().catch(() => undefined),
    clearOfflineWorkoutSnapshots().catch(() => undefined),
    clearPersistedQueries().catch(() => undefined),
  ])
}
