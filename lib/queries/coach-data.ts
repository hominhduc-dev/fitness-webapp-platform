"use client"

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { useUserQuery, userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

/** Query owns server data; callers may reconcile a successful write in the cache. */
export function useCoachData<T>(
  queryKey: QueryKey,
  read: (token: string) => Promise<T>,
  initialData?: T,
  enabled = true,
  staleTime = 5 * 60_000,
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
