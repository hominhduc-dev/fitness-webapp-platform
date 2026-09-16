import { clearServiceWorkerUserCaches } from "@/lib/offline/service-worker"

/** Drops everything cached for offline use that belongs to the signed-in user. */
export async function clearOfflineUserData() {
  await clearServiceWorkerUserCaches().catch(() => undefined)
}
