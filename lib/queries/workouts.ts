"use client"

import { useMutation, useQueries, useQueryClient, type Query, type QueryClient } from "@tanstack/react-query"
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
  deleteWorkoutSessionDraft,
  deleteWorkoutLog,
  fetchActiveWorkoutSessions,
  swapWorkoutExercise,
  updateTraineeProgram,
  updateWorkout,
  fetchWorkouts,
  fetchWorkoutDetail,
  fetchWorkoutSessionDraft,
  fetchTraineeProgram,
  upsertWorkoutSessionDraft,
} from "@/lib/fitness/api"
import type { StoredWorkoutSession } from "@/lib/workout/session-storage"

export function useWorkouts(initialData?: Awaited<ReturnType<typeof fetchWorkouts>>, options?: { enabled?: boolean }) {
  return useUserQuery({ queryKey: queryKeys.workouts.collection(),
    queryFn: async () => fetchWorkouts(await requireAccessToken()), initialData, enabled: options?.enabled })
}

/** Warm the shared collection used by both /schedule and /workout. */
export function prefetchWorkouts(queryClient: QueryClient, userId: string) {
  return queryClient.prefetchQuery({
    queryKey: userQueryKey(queryKeys.workouts.collection(), userId),
    queryFn: async () => fetchWorkouts(await requireAccessToken()),
    staleTime: 30_000,
  })
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

/** The default gcTime: an in-memory session seed younger than this is reused as-is. */
export const ACTIVE_SESSION_SEED_REUSE_MS = 5 * 60_000

function activeSessionStaleTime(query: Query<Workout>) {
  return Date.now() - query.state.dataUpdatedAt > ACTIVE_SESSION_SEED_REUSE_MS ? 0 : "static" as const
}

export function useWorkoutDetail(workoutId: string, options: { initialData?: Workout; enabled?: boolean; activeSession?: boolean; select?: (workout: Workout) => Workout } = {}) {
  return useUserQuery<Workout>({
    queryKey: queryKeys.workouts.detail(workoutId),
    queryFn: async () => fetchWorkoutDetail(await requireAccessToken(), workoutId),
    initialData: options.initialData,
    enabled: Boolean(workoutId) && (options.enabled ?? true),
    select: options.select,
    // Static also blocks invalidation refetches; Infinity alone does not. A seed
    // older than the reuse window can only have been restored from storage, so
    // it goes stale and refetches once rather than starting a session from it.
    ...(options.activeSession ? { staleTime: activeSessionStaleTime, refetchOnMount: true as const,
      refetchOnWindowFocus: false as const, refetchOnReconnect: false as const } : {}),
  })
}

export function useActiveWorkoutSessions() {
  return useUserQuery({
    queryKey: queryKeys.workouts.sessionDrafts(),
    queryFn: async () => fetchActiveWorkoutSessions(await requireAccessToken()),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function useWorkoutSessionDraft(workoutId: string, options?: { enabled?: boolean }) {
  return useUserQuery({
    queryKey: queryKeys.workouts.sessionDraft(workoutId),
    queryFn: async () => fetchWorkoutSessionDraft(await requireAccessToken(), workoutId),
    enabled: Boolean(workoutId) && (options?.enabled ?? true),
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useUpsertWorkoutSessionDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workoutId, input }: { workoutId: string; input: StoredWorkoutSession }) =>
      upsertWorkoutSessionDraft(await requireAccessToken(), workoutId, input),
    onSuccess: (draft, { workoutId }) => {
      queryClient.setQueryData(queryKeys.workouts.sessionDraft(workoutId), draft)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.sessionDrafts() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.collection() })
    },
  })
}

export function useDeleteWorkoutSessionDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workoutId: string) => deleteWorkoutSessionDraft(await requireAccessToken(), workoutId),
    onSuccess: (_result, workoutId) => {
      queryClient.setQueryData(queryKeys.workouts.sessionDraft(workoutId), null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.sessionDrafts() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.collection() })
    },
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
