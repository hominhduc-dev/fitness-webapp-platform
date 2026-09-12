"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
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
} from "@/lib/fitness/api"

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
