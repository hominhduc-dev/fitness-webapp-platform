"use client"

import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { fetchCoachExercises, fetchCoachNavCounts, fetchCoachPrograms, fetchCoachTrainees } from "@/lib/fitness/api"
import { queryKeys } from "@/lib/queries/keys"
import { useUserQuery, userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

/** Coach lists change only through the coach's own writes, which invalidate them. */
export const COACH_DATA_STALE_TIME_MS = 5 * 60_000
/** The sidebar badges also move when a trainee accepts a request, so they refresh sooner. */
const COACH_NAV_COUNTS_STALE_TIME_MS = 30_000

/** Query owns server data; callers may reconcile a successful write in the cache. */
export function useCoachData<T>(
  queryKey: QueryKey,
  read: (token: string) => Promise<T>,
  initialData?: T,
  enabled = true,
  staleTime = COACH_DATA_STALE_TIME_MS,
) {
  const client = useQueryClient()
  const { profile } = useAuth()
  const query = useUserQuery<T>({
    queryKey, initialData, enabled, staleTime,
    queryFn: async () => read(await requireAccessToken()),
  })
  const setData = (update: T | ((current: T) => T)) => {
    client.setQueryData<T>(userQueryKey(queryKey, profile?.id), (current) => {
      if (typeof update !== "function") return update
      const previous = current ?? initialData
      return previous === undefined ? previous : (update as (value: T) => T)(previous)
    })
  }
  return { ...query, setData }
}

/** Shared by the sidebar badges and /coach/stats, so the stats page opens from cache. */
export function useCoachNavCounts() {
  return useUserQuery({
    queryKey: queryKeys.coach.navCounts(),
    queryFn: async () => fetchCoachNavCounts(await requireAccessToken()),
    staleTime: COACH_NAV_COUNTS_STALE_TIME_MS,
  })
}

/**
 * Warms the data behind the coach sidebar tabs before the coach clicks one.
 *
 * Keys and read functions must match what each page passes to `useCoachData`
 * (the programs board opens on the non-archived list), otherwise the page misses
 * this cache and fetches again.
 */
export function prefetchCoachRoutes(queryClient: QueryClient, userId: string) {
  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: userQueryKey(queryKeys.coach.navCounts(), userId),
      queryFn: async () => fetchCoachNavCounts(await requireAccessToken()),
      staleTime: COACH_NAV_COUNTS_STALE_TIME_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: userQueryKey(queryKeys.coach.trainees(), userId),
      queryFn: async () => fetchCoachTrainees(await requireAccessToken()),
      staleTime: COACH_DATA_STALE_TIME_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: userQueryKey(queryKeys.coach.programs({ includeArchived: false }), userId),
      queryFn: async () => fetchCoachPrograms(await requireAccessToken(), { includeArchived: false }),
      staleTime: COACH_DATA_STALE_TIME_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: userQueryKey(queryKeys.coach.exercises(), userId),
      queryFn: async () => fetchCoachExercises(await requireAccessToken()),
      staleTime: COACH_DATA_STALE_TIME_MS,
    }),
  ])
}

/** Token is resolved when the write executes, never captured from session state. */
export function useCoachMutation<A extends unknown[], T>(
  write: (token: string, ...args: A) => Promise<T>,
  domains: readonly string[] = ["coach", "workouts"],
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (args: A) => write(await requireAccessToken(), ...args),
    onSuccess: () => {
      for (const domain of domains) void client.invalidateQueries({ queryKey: [domain] })
    },
  })
}
