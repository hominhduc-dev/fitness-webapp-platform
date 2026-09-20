"use client"

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import * as api from "@/lib/fitness/api"
import { queryKeys } from "@/lib/queries/keys"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

/** Shared library key lets the generator reuse the exercise picker's cache. */
export function useAIExerciseLibrary(initialData?: Awaited<ReturnType<typeof api.fetchExerciseLibrary>>) {
  return useUserQuery({
    queryKey: queryKeys.exercises.library(),
    queryFn: async () => api.fetchExerciseLibrary(await requireAccessToken()),
    initialData,
    staleTime: 30 * 60_000,
  })
}

function useAIMutation<A extends unknown[], T>(fn: (token: string, ...args: A) => Promise<T>, domains: readonly QueryKey[]) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (args: A) => fn(await requireAccessToken(), ...args),
    onSuccess: async () => {
      await Promise.all(domains.map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
}

export function useGenerateAIProgram() {
  return useAIMutation(api.generateAIProgram, [])
}

export function useGenerateCoachTraineeAIProgram() {
  return useAIMutation(api.generateCoachTraineeAIProgram, [])
}

export function useAcceptAIProgram() {
  return useAIMutation(api.acceptAIProgram, [queryKeys.workouts.all, queryKeys.coach.all, queryKeys.progress.all])
}

export function useAcceptCoachTraineeAIProgram() {
  return useAIMutation(api.acceptCoachTraineeAIProgram, [queryKeys.workouts.all, queryKeys.coach.all, queryKeys.progress.all])
}

export function useGenerateAIDailyWorkout() {
  return useAIMutation(api.generateAIDailyWorkout, [])
}

export function useAcceptAIDailyWorkout() {
  return useAIMutation(api.acceptAIDailyWorkout, [queryKeys.workouts.all, queryKeys.coach.all, queryKeys.progress.all])
}

/**
 * The plan left behind by a sheet that was closed without saving. Read when the
 * sheet opens so an accidental dismissal does not cost another generation out
 * of the daily budget.
 */
export function useAIMealPlanDraft() {
  return useUserQuery({
    queryKey: queryKeys.ai.mealPlanDraft(),
    queryFn: async () => api.fetchAIMealPlanDraft(await requireAccessToken()),
    staleTime: 0,
  })
}

export function useGenerateAIMealPlan() {
  return useAIMutation(api.generateAIMealPlan, [queryKeys.ai.all])
}

export function useAcceptAIMealPlan() {
  return useAIMutation(api.acceptAIMealPlan, [queryKeys.ai.all, queryKeys.meals.all, ["workouts", "dashboard"]])
}

export function useRegenerateAIMealPlanMeal() {
  return useAIMutation(api.regenerateAIMealPlanMeal, [queryKeys.ai.all])
}

export function useDiscardAIMealPlanDraft() {
  return useAIMutation(api.discardAIMealPlanDraft, [queryKeys.ai.all])
}

export function useSendAIChatMessage() {
  return useAIMutation(api.sendAIChatMessage, [])
}
