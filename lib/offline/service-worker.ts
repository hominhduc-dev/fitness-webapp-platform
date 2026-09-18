const SERVICE_WORKER_URL = "/sw.js"
const CACHE_OFFLINE_PAGE = "CACHE_OFFLINE_PAGE"

function supportsServiceWorker() {
  return typeof window !== "undefined" && "serviceWorker" in navigator
}

export async function registerServiceWorker() {
  if (!supportsServiceWorker()) return null
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" })
}

/**
 * Asks the active worker to fetch and retain the exact authenticated workout
 * route while the network is available. A later offline navigation can then
 * boot the client logger instead of falling through to offline.html.
 */
export async function warmOfflineWorkoutRoute(workoutId: string): Promise<boolean> {
  if (!supportsServiceWorker()) return false
  const registration = await navigator.serviceWorker.ready
  const worker = registration.active
  if (!worker) return false

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => resolve(false), 10_000)
    channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
      window.clearTimeout(timeout)
      resolve(event.data?.ok === true)
    }
    worker.postMessage(
      { type: CACHE_OFFLINE_PAGE, url: `/workout/${encodeURIComponent(workoutId)}/start` },
      [channel.port2],
    )
  })
}

/**
 * Cached page HTML embeds the signed-in user's profile, so it must not outlive
 * the session. The worker owns the cache names; this only asks it to purge.
 */
export async function clearServiceWorkerUserCaches() {
  if (!supportsServiceWorker()) return
  const registration = await navigator.serviceWorker.getRegistration("/")
  registration?.active?.postMessage({ type: "CLEAR_USER_CACHES" })
}
