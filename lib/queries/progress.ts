"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useUserQuery as useQuery } from "./scoped"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import type { BodyMetricQueryOptions } from "@/lib/queries/types"
import {
  createWeightEntry,
  fetchProgressAnalytics,
  fetchProgressCalendar,
  fetchProgressYearView,
  fetchWeightEntries,
  fetchWorkoutLogDetail,
} from "@/lib/fitness/api"
import type { BodyMetricEntry, ProgressCalendar } from "@/lib/fitness/types"

/** Reference-ish: only this user changes it, from two screens that invalidate. */
const WEIGHT_STALE_TIME_MS = 30_000
const PROGRESS_STALE_TIME_MS = 30_000
/** A finished session's sets never change, so a reopened log is a cache read. */
const IMMUTABLE_STALE_TIME_MS = 30 * 60_000

/**
 * `enabled` reads the token only as a boolean — the string itself never reaches
 * a key or a dependency array. A query with `initialData` still renders its seed
 * while disabled, so this gate costs no loading flash on a seeded page.
 */
export function useWeightEntries(
  options?: number | BodyMetricQueryOptions,
  seed?: { initialData?: BodyMetricEntry[] },
) {
  return useQuery({
    queryKey: queryKeys.progress.weightEntries(options),
    queryFn: async () => fetchWeightEntries(await requireAccessToken(), options),
    initialData: seed?.initialData,
    staleTime: WEIGHT_STALE_TIME_MS,
  })
}

export function useProgressCalendar(
  year: number,
  month: number,
  options?: { summaryOnly?: boolean; initialData?: ProgressCalendar | null; enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.progress.calendar(year, month, { summaryOnly: options?.summaryOnly }),
    queryFn: async () =>
      fetchProgressCalendar(await requireAccessToken(), year, month, {
        summaryOnly: options?.summaryOnly,
      }),
    enabled: options?.enabled ?? true,
    // `?? undefined`, not `?? null`: the server page catches its own failures and
    // passes null, and seeding null would cache a failure as if it were data.
    initialData: options?.initialData ?? undefined,
    staleTime: PROGRESS_STALE_TIME_MS,
  })
}

export function useProgressAnalytics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.progress.analytics(),
    queryFn: async () => fetchProgressAnalytics(await requireAccessToken()),
    enabled: options?.enabled ?? true,
    staleTime: PROGRESS_STALE_TIME_MS,
  })
}

export function useProgressYearView(year: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.progress.yearView(year),
    queryFn: async () => fetchProgressYearView(await requireAccessToken(), year),
    enabled: options?.enabled ?? true,
    staleTime: PROGRESS_STALE_TIME_MS,
  })
}

export function useWorkoutLogDetail(logId: string | null) {
  return useQuery({
    queryKey: queryKeys.progress.workoutLogDetail(logId ?? ""),
    queryFn: async () => fetchWorkoutLogDetail(await requireAccessToken(), logId ?? ""),
    enabled: Boolean(logId),
    staleTime: IMMUTABLE_STALE_TIME_MS,
  })
}

export function useCreateWeightEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Parameters<typeof createWeightEntry>[1]) =>
      createWeightEntry(await requireAccessToken(), input),
    onSuccess: () => {
      // Every range variant of the weight list, plus the profile's current weight.
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })
    },
  })
}
