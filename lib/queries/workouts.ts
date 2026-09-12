"use client"

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import { userQueryKey, useUserQuery } from "@/lib/queries/scoped"
import type { CoachProgram } from "@/lib/fitness/types"
import type { Workout } from "@/lib/types"
import {
  addWorkoutToProgram,
  copyProgramWeek,
  createWorkout,
  createWorkoutLog,
  deleteWorkout,
  deleteWorkoutLog,
  swapWorkoutExercise,
  updateTraineeProgram,
  updateWorkout,
  fetchWorkouts,
  fetchWorkoutDetail,
  fetchTraineeProgram,
} from "@/lib/fitness/api"

export function useWorkouts(initialData?: Awaited<ReturnType<typeof fetchWorkouts>>) {
  return useUserQuery({ queryKey: queryKeys.workouts.collection(),
    queryFn: async () => fetchWorkouts(await requireAccessToken()), initialData })
}

export function useTraineePrograms(programIds: string[], enabled: boolean) {
  const { profile } = useAuth()
  return useQueries({ queries: programIds.map((programId) => ({
    queryKey: userQueryKey(queryKeys.workouts.traineeProgram(programId), profile?.id),
    queryFn: async () => fetchTraineeProgram(await requireAccessToken(), programId),
    enabled: Boolean(profile?.id) && enabled,
    staleTime: 300_000,
    retry: false,
    // Failed programs settle as errors, without an effect retry loop or fake null data.
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })) })
}

export function useWorkoutDetail(workoutId: string, options: { initialData?: Workout; enabled?: boolean; activeSession?: boolean; select?: (workout: Workout) => Workout } = {}) {
  return useUserQuery<Workout>({
    queryKey: queryKeys.workouts.detail(workoutId),
    queryFn: async () => fetchWorkoutDetail(await requireAccessToken(), workoutId),
    initialData: options.initialData,
    enabled: Boolean(workoutId) && (options.enabled ?? true),
    select: options.select,
    // Static also blocks invalidation refetches; Infinity alone does not.
    ...(options.activeSession ? { staleTime: "static" as const, refetchOnMount: false as const,
      refetchOnWindowFocus: false as const, refetchOnReconnect: false as const } : {}),
  })
}

export function useTraineeProgram(programId: string, initialData?: CoachProgram, enabled = true) {
  return useUserQuery({ queryKey: queryKeys.workouts.traineeProgram(programId),
    queryFn: async () => fetchTraineeProgram(await requireAccessToken(), programId),
    initialData, enabled: Boolean(programId) && enabled, staleTime: 300_000 })
}

/**
 * A finished, deleted or edited session moves the schedule, the dashboard
 * streak, the calendar, analytics and the muscle map. Rather than enumerate
 * those, invalidate the two domain prefixes that cover them.
 *
 * Over-invalidating costs a few requests that can be tightened later.
 * Under-invalidating shows the user stale numbers and is silent, so the coarse
 * sweep is the deliberate default while the migration settles.
 */
function useInvalidateTrainingData() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
  }
}

export function useDeleteWorkout() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async (workoutId: string) => deleteWorkout(await requireAccessToken(), workoutId),
    onSuccess: invalidateTrainingData,
  })
}

export function useCreateWorkout() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async (input: Parameters<typeof createWorkout>[1]) =>
      createWorkout(await requireAccessToken(), input),
    onSuccess: invalidateTrainingData,
  })
}

export function useUpdateWorkout() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async ({
      workoutId,
      input,
    }: {
      workoutId: string
      input: Parameters<typeof updateWorkout>[2]
    }) => updateWorkout(await requireAccessToken(), workoutId, input),
    onSuccess: invalidateTrainingData,
  })
}

export function useCreateWorkoutLog() {
  const invalidateTrainingData = useInvalidateTrainingData()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workoutId,
      input,
    }: {
      workoutId: string
      input: Parameters<typeof createWorkoutLog>[2]
    }) => createWorkoutLog(await requireAccessToken(), workoutId, input),
    onSuccess: () => {
      invalidateTrainingData()
      // The coach's view of this trainee's logs changes too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

export function useDeleteWorkoutLog() {
  const invalidateTrainingData = useInvalidateTrainingData()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workoutId, logId }: { workoutId: string; logId: string }) =>
      deleteWorkoutLog(await requireAccessToken(), workoutId, logId),
    onSuccess: () => {
      invalidateTrainingData()
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

export function useSwapWorkoutExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workoutId,
      workoutExerciseId,
      variationId,
    }: {
      workoutId: string
      workoutExerciseId: string
      variationId: string
    }) => swapWorkoutExercise(await requireAccessToken(), workoutId, workoutExerciseId, variationId),
    onSuccess: (_result, { workoutId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.detail(workoutId) })
    },
  })
}

export function useAddWorkoutToProgram() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async ({
      programId,
      input,
    }: {
      programId: string
      input: Parameters<typeof addWorkoutToProgram>[2]
    }) => addWorkoutToProgram(await requireAccessToken(), programId, input),
    onSuccess: invalidateTrainingData,
  })
}

export function useCopyProgramWeek() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async ({
      programId,
      input,
    }: {
      programId: string
      input: Parameters<typeof copyProgramWeek>[2]
    }) => copyProgramWeek(await requireAccessToken(), programId, input),
    onSuccess: invalidateTrainingData,
  })
}

export function useUpdateTraineeProgram() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async ({
      programId,
      input,
    }: {
      programId: string
      input: Parameters<typeof updateTraineeProgram>[2]
    }) => updateTraineeProgram(await requireAccessToken(), programId, input),
    onSuccess: invalidateTrainingData,
  })
}
