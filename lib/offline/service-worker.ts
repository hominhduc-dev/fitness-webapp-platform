const SERVICE_WORKER_URL = "/sw.js"

function supportsServiceWorker() {
  return typeof window !== "undefined" && "serviceWorker" in navigator
}

export async function registerServiceWorker() {
  if (!supportsServiceWorker()) return null
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" })
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
