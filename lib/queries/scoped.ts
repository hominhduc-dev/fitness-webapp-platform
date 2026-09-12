"use client"

import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { useState } from "react"

/** Domain prefixes remain usable for invalidation; private rows never share a key. */
export function userQueryKey(key: QueryKey, userId: string | null | undefined) {
  return [...key, { userId: userId ?? null }] as const
}

export function useUserQuery<T, TData = T>(options: Omit<UseQueryOptions<T, Error, TData>, "enabled"> & { enabled?: boolean }) {
  const { profile } = useAuth()
  const [seedOwner] = useState(profile?.id)
  return useQuery({
    ...options,
    initialData: seedOwner === profile?.id ? options.initialData : undefined,
    queryKey: userQueryKey(options.queryKey, profile?.id),
    enabled: Boolean(profile?.id) && (options.enabled ?? true),
  })
}
