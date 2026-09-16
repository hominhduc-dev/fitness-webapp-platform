import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { removeOldestQuery, type PersistedClient, type Persister } from "@tanstack/react-query-persist-client"
import { isServer, partialMatchKey, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queries/keys"

/** A restored snapshot older than this is discarded instead of rendered. */
export const PERSISTED_QUERY_MAX_AGE_MS = 24 * 60 * 60_000

/**
 * Bump when a persisted payload changes shape: a mismatched buster makes the
 * restore throw the stored snapshot away rather than render it with new code.
 */
export const PERSISTED_QUERY_BUSTER = "v1"

const STORAGE_KEY = "yeahbuddy-query-cache"

/**
 * The only queries written to localStorage: what a trainee needs to open the
 * app and start a session without signal. Coach, admin and search results are
 * deliberately absent — they hold other people's data or are too large for the
 * ~5MB localStorage budget.
 */
export const PERSISTED_QUERY_PREFIXES: readonly QueryKey[] = [
  queryKeys.profile.current(),
  ["workouts", "dashboard"],
  queryKeys.workouts.collection(),
  // Seeds an active session, so a workout opened online can be started offline.
  ["workouts", "detail"],
  ["meals", "nutrition-day"],
  queryKeys.progress.analytics(),
  ["progress", "dashboard"],
]

function hasOwner(queryKey: QueryKey) {
  const scope = queryKey.at(-1)
  return typeof scope === "object" && scope !== null && typeof (scope as { userId?: unknown }).userId === "string"
}

export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">) {
  return (
    query.state.status === "success" &&
    // Unscoped keys could be read back by whoever signs in next on this device.
    hasOwner(query.queryKey) &&
    PERSISTED_QUERY_PREFIXES.some((prefix) => partialMatchKey(query.queryKey, prefix))
  )
}

/**
 * Persisted queries must outlive the default five-minute gcTime, otherwise a
 * screen the trainee hasn't opened in a while is collected — and dropped from
 * storage on the next write — before they ever go offline.
 */
export function applyPersistedQueryDefaults(queryClient: QueryClient) {
  for (const queryKey of PERSISTED_QUERY_PREFIXES) {
    queryClient.setQueryDefaults(queryKey, { gcTime: PERSISTED_QUERY_MAX_AGE_MS })
  }
}

const DATE_TAG = "$date"

/** API mappers hand back `Date` instances, which plain JSON flattens to strings. */
export function serializePersistedClient(client: PersistedClient) {
  return JSON.stringify(client, function replacer(this: Record<string, unknown>, key, value) {
    const raw = this[key]
    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : { [DATE_TAG]: raw.toISOString() }
    }
    return value
  })
}

export function deserializePersistedClient(serialized: string): PersistedClient {
  return JSON.parse(serialized, (_key, value) => {
    if (
      typeof value === "object" &&
      value !== null &&
      typeof value[DATE_TAG] === "string" &&
      Object.keys(value).length === 1
    ) {
      return new Date(value[DATE_TAG])
    }
    return value
  })
}

function getStorage() {
  try {
    return window.localStorage
  } catch {
    // Blocked storage (private mode, disabled site data) falls back to memory only.
    return undefined
  }
}

let persister: Persister | undefined

/** One persister per tab so every provider mount shares its write throttle. */
export function getQueryPersister() {
  persister ??= createSyncStoragePersister({
    deserialize: deserializePersistedClient,
    key: STORAGE_KEY,
    // Over quota: evict the oldest query and retry rather than stop persisting.
    retry: removeOldestQuery,
    serialize: serializePersistedClient,
    storage: isServer ? undefined : getStorage(),
    throttleTime: 1_000,
  })

  return persister
}

export async function clearPersistedQueries() {
  if (isServer) return
  await getQueryPersister().removeClient()
}
