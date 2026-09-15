const IDLE_TIMEOUT_MS = 1_500
/** Safari has no requestIdleCallback; a short delay still lets first paint win. */
const FALLBACK_DELAY_MS = 250

/**
 * Runs background work once the browser is idle and returns a cancel function,
 * so it can be returned straight from a `useEffect`.
 */
export function scheduleIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS })
    return () => window.cancelIdleCallback(idleId)
  }

  const timeoutId = globalThis.setTimeout(callback, FALLBACK_DELAY_MS)
  return () => globalThis.clearTimeout(timeoutId)
}
