import { QueryClient, dehydrate } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { queryKeys } from "./keys"
import {
  PERSISTED_QUERY_MAX_AGE_MS,
  applyPersistedQueryDefaults,
  deserializePersistedClient,
  serializePersistedClient,
  shouldPersistQuery,
} from "./persist"
import { userQueryKey } from "./scoped"

function persistedKeys(client: QueryClient) {
  return dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }).queries.map((query) => query.queryKey)
}

describe("shouldPersistQuery", () => {
  it("keeps allowlisted trainee queries scoped to a user", () => {
    const client = new QueryClient()
    const collection = userQueryKey(queryKeys.workouts.collection(), "user-a")
    const detail = userQueryKey(queryKeys.workouts.detail("w1"), "user-a")
    client.setQueryData(collection, { schedule: [] })
    client.setQueryData(detail, { id: "w1" })

    expect(persistedKeys(client)).toEqual(expect.arrayContaining([collection, detail]))
  })

  it("drops coach, admin and search data even when user-scoped", () => {
    const client = new QueryClient()
    client.setQueryData(userQueryKey(queryKeys.coach.trainees(), "coach-a"), [])
    client.setQueryData(userQueryKey(queryKeys.admin.users(), "admin-a"), [])
    client.setQueryData(userQueryKey(queryKeys.exercises.library(), "user-a"), [])

    expect(persistedKeys(client)).toEqual([])
  })

  it("drops allowlisted keys that carry no owner", () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.workouts.collection(), { schedule: [] })
    client.setQueryData(userQueryKey(queryKeys.workouts.collection(), null), { schedule: [] })

    expect(persistedKeys(client)).toEqual([])
  })
})

describe("persisted client serialization", () => {
  it("round-trips Date instances the API mappers produce", () => {
    const startedAt = new Date("2026-09-16T08:30:00.000Z")
    const client = new QueryClient()
    const key = userQueryKey(queryKeys.workouts.collection(), "user-a")
    client.setQueryData(key, { logs: [{ note: "$date", startedAt }], invalid: new Date(Number.NaN) })

    const restored = deserializePersistedClient(serializePersistedClient({
      buster: "v1",
      clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }),
      timestamp: 1,
    }))
    const data = restored.clientState.queries[0].state.data as { invalid: unknown; logs: Array<{ note: string; startedAt: Date }> }

    expect(data.logs[0].startedAt).toBeInstanceOf(Date)
    expect(data.logs[0].startedAt.toISOString()).toBe(startedAt.toISOString())
    expect(data.logs[0].note).toBe("$date")
    expect(data.invalid).toBeNull()
  })
})

describe("applyPersistedQueryDefaults", () => {
  it("keeps persisted queries in memory as long as they may be restored", () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 5 * 60_000 } } })
    applyPersistedQueryDefaults(client)

    const persisted = client.defaultQueryOptions({ queryKey: userQueryKey(queryKeys.workouts.detail("w1"), "user-a") })
    const other = client.defaultQueryOptions({ queryKey: userQueryKey(queryKeys.coach.dashboard(), "user-a") })

    expect(persisted.gcTime).toBe(PERSISTED_QUERY_MAX_AGE_MS)
    expect(other.gcTime).toBe(5 * 60_000)
  })
})
