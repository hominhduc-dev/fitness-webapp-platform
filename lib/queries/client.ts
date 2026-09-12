import { QueryClient, isServer } from "@tanstack/react-query"

import { ApiError } from "@/lib/auth/api"

/** Matches the `revalidate: 30` that `request()` applies to server-side GETs. */
const DEFAULT_STALE_TIME_MS = 30_000
const DEFAULT_GC_TIME_MS = 5 * 60_000
const MAX_RETRIES = 2

/**
 * The backend rate-limits per bearer token and answers 429, so retrying a 4xx
 * only digs the hole deeper. Client errors are not transient; server errors are.
 */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }

  return failureCount < MAX_RETRIES
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: DEFAULT_GC_TIME_MS,
        // Refetching on focus would fire a burst of requests every time a
        // trainee switches back to the app mid-set.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: shouldRetry,
        staleTime: DEFAULT_STALE_TIME_MS,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * One cache per browser tab, a fresh one per server render.
 *
 * The browser singleton is load-bearing rather than an optimisation: providers
 * are mounted separately under `app/(shell)`, `app/workout`, `app/page.tsx`,
 * `app/reset-password` and `app/dev`, so navigating from the shell into a
 * workout session unmounts one provider tree and mounts another. A per-mount
 * client would drop the whole cache at exactly that boundary.
 *
 * On the server the opposite rule applies: a shared client would leak one
 * user's data into another user's render.
 */
export function getQueryClient() {
  if (isServer) {
    return createQueryClient()
  }

  browserQueryClient ??= createQueryClient()

  return browserQueryClient
}
