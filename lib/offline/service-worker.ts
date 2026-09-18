const SERVICE_WORKER_URL = "/sw.js"
const CACHE_OFFLINE_PAGE = "CACHE_OFFLINE_PAGE"
const CACHE_REQUEST_TIMEOUT_MS = 10_000

function supportsServiceWorker() {
  return typeof window !== "undefined" && "serviceWorker" in navigator
}

export async function registerServiceWorker() {
  if (!supportsServiceWorker()) return null
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" })
}

/**
 * Asks the active worker to fetch and retain one authenticated route while the
 * network is available.
 *
 * Inside the app every link is a client-side navigation, which only fetches an
 * RSC payload — the worker never sees a document and therefore never caches
 * one. Without this, a route is offline-capable only if the trainee happened to
 * open it with a full page load.
 */
export async function warmOfflineRoute(route: string): Promise<boolean> {
  if (!supportsServiceWorker()) return false
  const registration = await navigator.serviceWorker.ready

  const warmWith = (worker: ServiceWorker | null): Promise<boolean> => {
    if (!worker) return Promise.resolve(false)

    return new Promise((resolve) => {
      const channel = new MessageChannel()
      const timeout = window.setTimeout(() => resolve(false), CACHE_REQUEST_TIMEOUT_MS)
      channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
        window.clearTimeout(timeout)
        resolve(event.data?.ok === true)
      }
      worker.postMessage(
        { type: CACHE_OFFLINE_PAGE, url: route },
        [channel.port2],
      )
    })
  }

  if (await warmWith(navigator.serviceWorker.controller ?? registration.active)) return true

  // During a deployment the page can still be controlled by the previous
  // worker, which does not understand CACHE_OFFLINE_PAGE. Wait once for the new
  // worker to claim the page, then retry instead of leaving the logger unpinned.
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
      resolve(value)
    }
    const handleControllerChange = () => {
      void warmWith(navigator.serviceWorker.controller).then(finish)
    }
    const timeout = window.setTimeout(() => finish(false), CACHE_REQUEST_TIMEOUT_MS)
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
  })
}

/** The logger document for one workout, which is the route a session needs. */
export function warmOfflineWorkoutRoute(workoutId: string): Promise<boolean> {
  return warmOfflineRoute(`/workout/${encodeURIComponent(workoutId)}/start`)
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
