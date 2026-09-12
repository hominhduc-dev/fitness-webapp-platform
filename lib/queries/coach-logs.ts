"use client"

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { createCoachWorkoutLogComment, deleteCoachWorkoutLogComment, fetchCoachBodyMetrics, fetchCoachWorkoutLogs, updateCoachWorkoutLogComment } from "@/lib/fitness/api"
import { queryKeys } from "./keys"
import { userQueryKey, useUserQuery } from "./scoped"
import { requireAccessToken } from "./token"

export type CoachLogFilters = NonNullable<Parameters<typeof fetchCoachWorkoutLogs>[2]>

export function coachLogKey(kind: "infinite" | "page", traineeId: string, filters: CoachLogFilters) {
  return ["coach", "workout-logs", kind, traineeId, { ...filters }] as const
}

export function useCoachLogs(traineeId: string, weekStart: string) {
  const { profile } = useAuth()
  const filters = { weekStart, limit: 20 }
  return useInfiniteQuery({
    queryKey: userQueryKey(coachLogKey("infinite", traineeId, filters), profile?.id),
    enabled: Boolean(profile?.id && traineeId && weekStart),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => fetchCoachWorkoutLogs(await requireAccessToken(), traineeId, { ...filters, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 30_000,
  })
}

export function coachBodyMetricsOptions(traineeId: string, filters: Parameters<typeof fetchCoachBodyMetrics>[2]) {
  return {
    queryKey: queryKeys.coach.bodyMetrics(traineeId, filters),
    queryFn: async () => fetchCoachBodyMetrics(await requireAccessToken(), traineeId, filters),
    staleTime: 30_000,
  }
}

export function useCoachLogBodyMetrics(traineeId: string, filters: Parameters<typeof fetchCoachBodyMetrics>[2], enabled = true) {
  return useUserQuery({ ...coachBodyMetricsOptions(traineeId, filters), enabled })
}

type CommentAction = { logId: string } & (
  | { action: "create"; content: string }
  | { action: "update"; commentId: string; content: string }
  | { action: "delete"; commentId: string }
)

export function useCoachLogComment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: CommentAction) => {
      const token = await requireAccessToken()
      if (input.action === "create") return createCoachWorkoutLogComment(token, input.logId, input.content)
      if (input.action === "update") return updateCoachWorkoutLogComment(token, input.commentId, input.content)
      return deleteCoachWorkoutLogComment(token, input.commentId)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.coach.all }),
        client.invalidateQueries({ queryKey: queryKeys.progress.all }),
        client.invalidateQueries({ queryKey: queryKeys.workouts.all }),
      ])
    },
  })
}
