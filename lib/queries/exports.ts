"use client"

import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { exportCoachWorkoutLogsToGoogleSheets, exportWorkoutLogsToGoogleSheets, fetchCoachProgram, fetchCoachWorkoutLogs, fetchTraineeProgram, fetchWeightEntries, fetchWorkoutLogsForExport } from "@/lib/fitness/api"
import { coachBodyMetricsOptions, coachLogKey, type CoachLogFilters } from "./coach-logs"
import { queryKeys } from "./keys"
import { userQueryKey } from "./scoped"
import { requireAccessToken } from "./token"

export async function loadAllCoachLogs(client: QueryClient, profileId: string, traineeId: string, filters: Omit<CoachLogFilters, "cursor">) {
  const logs: Awaited<ReturnType<typeof fetchCoachWorkoutLogs>>["logs"] = []
  const cursors = new Set<string>()
  let cursor: string | undefined
  do {
    const options = { ...filters, limit: filters.limit ?? 50, cursor }
    const result = await client.fetchQuery({
      queryKey: userQueryKey(coachLogKey("page", traineeId, options), profileId),
      queryFn: async () => fetchCoachWorkoutLogs(await requireAccessToken(), traineeId, options),
      staleTime: 30_000,
    })
    logs.push(...result.logs)
    cursor = result.nextCursor
    if (cursor && cursors.has(cursor)) throw new Error("Workout log pagination did not advance.")
    if (cursor) cursors.add(cursor)
  } while (cursor)
  return logs
}

/** Imperative reads for user-triggered exports; every private cache entry is scoped. */
export function useExportQueries() {
  const client = useQueryClient()
  const { profile } = useAuth()
  const profileId = () => {
    if (!profile?.id) throw new Error("No active profile.")
    return profile.id
  }
  const read = <T,>(key: QueryKey, queryFn: () => Promise<T>, staleTime = 30_000) =>
    client.fetchQuery({ queryKey: userQueryKey(key, profileId()), queryFn, staleTime })
  return {
    coachLogs: (traineeId: string, filters: Omit<CoachLogFilters, "cursor">) => loadAllCoachLogs(client, profileId(), traineeId, filters),
    coachBodyMetrics: (traineeId: string, filters: Parameters<typeof coachBodyMetricsOptions>[1]) => {
      const options = coachBodyMetricsOptions(traineeId, filters)
      return read(options.queryKey, options.queryFn)
    },
    coachProgram: (id: string) => read(queryKeys.coach.program(id), async () => fetchCoachProgram(await requireAccessToken(), id), 300_000),
    traineeProgram: (id: string) => read(queryKeys.workouts.traineeProgram(id), async () => fetchTraineeProgram(await requireAccessToken(), id), 300_000),
    workoutLogs: (filters: Parameters<typeof fetchWorkoutLogsForExport>[1]) => read(["progress", "export-logs", { ...filters }], async () => fetchWorkoutLogsForExport(await requireAccessToken(), filters)),
    bodyMetrics: (filters: Parameters<typeof fetchWeightEntries>[1]) => read(queryKeys.progress.weightEntries(filters), async () => fetchWeightEntries(await requireAccessToken(), filters)),
  }
}

export function useCoachSheetsExport() {
  return useMutation({
    mutationFn: async ({ traineeId, options }: { traineeId: string; options: Parameters<typeof exportCoachWorkoutLogsToGoogleSheets>[2] }) =>
      exportCoachWorkoutLogsToGoogleSheets(await requireAccessToken(), traineeId, options),
    retry: false,
  })
}

export function useWorkoutSheetsExport() {
  return useMutation({
    mutationFn: async (options: Parameters<typeof exportWorkoutLogsToGoogleSheets>[1]) => exportWorkoutLogsToGoogleSheets(await requireAccessToken(), options),
    retry: false,
  })
}
