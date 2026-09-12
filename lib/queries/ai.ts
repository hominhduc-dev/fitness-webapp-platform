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

export function useAcceptAIProgram() {
  return useAIMutation(api.acceptAIProgram, [queryKeys.workouts.all, queryKeys.coach.all, queryKeys.progress.all])
}

export function useGenerateAIDailyWorkout() {
  return useAIMutation(api.generateAIDailyWorkout, [])
}

export function useAcceptAIDailyWorkout() {
  return useAIMutation(api.acceptAIDailyWorkout, [queryKeys.workouts.all, queryKeys.coach.all, queryKeys.progress.all])
}

export function useGenerateAIMealPlan() {
  return useAIMutation(api.generateAIMealPlan, [])
}

export function useAcceptAIMealPlan() {
  return useAIMutation(api.acceptAIMealPlan, [queryKeys.meals.all, ["workouts", "dashboard"]])
}

export function useSendAIChatMessage() {
  return useAIMutation(api.sendAIChatMessage, [])
}
