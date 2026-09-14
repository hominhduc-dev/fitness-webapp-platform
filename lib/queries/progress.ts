"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useUserQuery as useQuery } from "./scoped"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import type { BodyMetricQueryOptions } from "@/lib/queries/types"
import {
  createWeightEntry,
  fetchDashboardAnalytics,
  fetchProgressAnalytics,
  fetchProgressCalendar,
  fetchProgressYearView,
  fetchVolumeRecovery,
  fetchRecoveryHistory,
  fetchWeightEntries,
  resetVolumeLandmarks,
  saveVolumeLandmarks,
  setVolumeRecommendationStatus,
  fetchWorkoutLogDetail,
  upsertRecoveryCheckIn,
} from "@/lib/fitness/api"
import type { BodyMetricEntry, ProgressCalendar, RecoveryCheckInInput, RecoveryHistory } from "@/lib/fitness/types"

type ProgressAnalytics = Awaited<ReturnType<typeof fetchProgressAnalytics>>
type VolumeRecoveryData = Awaited<ReturnType<typeof fetchVolumeRecovery>>

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
  seed?: { enabled?: boolean; initialData?: BodyMetricEntry[] },
) {
  return useQuery({
    queryKey: queryKeys.progress.weightEntries(options),
    queryFn: async () => fetchWeightEntries(await requireAccessToken(), options),
    enabled: seed?.enabled ?? true,
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

/**
 * Server pages seed these hooks through `initialData`. A seeding call site that
 * should not fetch on its own passes `enabled: false`: the seed still lands in
 * the cache (TanStack applies `initialData` even to a query another observer
 * created first), and the components that render the data fetch when needed.
 */
export function useProgressAnalytics(options?: { enabled?: boolean; initialData?: ProgressAnalytics }) {
  return useQuery({
    queryKey: queryKeys.progress.analytics(),
    queryFn: async () => fetchProgressAnalytics(await requireAccessToken()),
    enabled: options?.enabled ?? true,
    initialData: options?.initialData,
    staleTime: PROGRESS_STALE_TIME_MS,
  })
}

export function useDashboardAnalytics(
  startDate: Date,
  endDate: Date,
  options?: { enabled?: boolean; initialData?: Awaited<ReturnType<typeof fetchDashboardAnalytics>> },
) {
  return useQuery({
    queryKey: queryKeys.progress.dashboard(startDate, endDate),
    queryFn: async () => fetchDashboardAnalytics(await requireAccessToken(), startDate, endDate),
    enabled: options?.enabled ?? true,
    initialData: options?.initialData,
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

export function useVolumeRecovery(options?: { enabled?: boolean; initialData?: VolumeRecoveryData; weekStart?: string }) {
  return useQuery({
    queryKey: queryKeys.progress.volumeRecovery(options?.weekStart),
    queryFn: async () => fetchVolumeRecovery(await requireAccessToken(), options?.weekStart),
    enabled: options?.enabled ?? true,
    initialData: options?.initialData,
    staleTime: PROGRESS_STALE_TIME_MS,
  })
}

export function useRecoveryHistory(days = 30, options?: { enabled?: boolean; initialData?: RecoveryHistory }) {
  return useQuery({
    queryKey: queryKeys.progress.recoveryHistory(days),
    queryFn: async () => fetchRecoveryHistory(await requireAccessToken(), days),
    enabled: options?.enabled ?? true,
    initialData: options?.initialData,
    staleTime: PROGRESS_STALE_TIME_MS,
  })
}

/**
 * Answering a recommendation, editing landmarks and resetting them all change
 * what the volume response returns, so each invalidates the whole progress tree
 * rather than trying to patch one muscle row in place.
 */
export function useSetVolumeRecommendationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Parameters<typeof setVolumeRecommendationStatus>[1]) =>
      setVolumeRecommendationStatus(await requireAccessToken(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
    },
  })
}

export function useSaveVolumeLandmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Parameters<typeof saveVolumeLandmarks>[1]) =>
      saveVolumeLandmarks(await requireAccessToken(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
    },
  })
}

export function useResetVolumeLandmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (muscleSlug: string) => resetVolumeLandmarks(await requireAccessToken(), muscleSlug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
    },
  })
}

export function useUpsertRecoveryCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecoveryCheckInInput) =>
      upsertRecoveryCheckIn(await requireAccessToken(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
    },
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
