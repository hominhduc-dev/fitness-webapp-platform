"use client"

import { useSyncExternalStore } from "react"

const subscribeToNothing = () => () => {}

/** False on the server and during hydration, true on every render after. */
export function useHasHydrated() {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false)
}

/**
 * A query's data that renders the same on the server and in the hydration pass.
 *
 * The client's cache can already hold newer data than the page was rendered
 * with (restored from storage, or refreshed by another screen), and reading it
 * while hydrating makes React throw away the server HTML. Until hydration the
 * server's seed is shown instead; after it, the live query takes over.
 */
export function useHydrationSafeQuery<T>(query: { data: T | undefined; isPending: boolean }, seed: T | undefined) {
  const hasHydrated = useHasHydrated()
  return hasHydrated
    ? { data: query.data, isPending: query.isPending }
    : { data: seed, isPending: seed === undefined }
}
