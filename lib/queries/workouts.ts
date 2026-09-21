"use client"

import { useMutation, useQueries, useQueryClient, type Query, type QueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import { userQueryKey, useUserQuery } from "@/lib/queries/scoped"
import { warmOfflineWorkoutRoute } from "@/lib/offline/service-worker"
import { saveOfflineWorkoutSnapshot } from "@/lib/offline/workout-snapshot"
import type { CoachProgram } from "@/lib/fitness/types"
import type { WorkoutCollection } from "@/lib/fitness/types"
import type { Workout } from "@/lib/types"
import {
  addWorkoutToProgram,
  copyProgramWeek,
  createWorkout,
  createWorkoutLog,
  deleteWorkout,
  deleteWorkoutLog,
  fetchActiveWorkoutSessions,
  swapWorkoutExercise,
  updateTraineeProgram,
  updateWorkout,
  duplicateWorkoutToRoutine,
  fetchWorkouts,
  fetchWorkoutDetail,
  fetchWorkoutSessionDraft,
  fetchTraineeProgram,
} from "@/lib/fitness/api"

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

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * Prepares the sessions a trainee is most likely to need without a network:
 * every active session, today's effective session and the next incomplete one.
 * The Query cache is the fast path; IndexedDB is the durable logger seed.
 */
export async function prefetchOfflineReadyWorkouts(queryClient: QueryClient, userId: string) {
  await prefetchWorkouts(queryClient, userId)
  const collection = queryClient.getQueryData<WorkoutCollection>(
    userQueryKey(queryKeys.workouts.collection(), userId),
  )
  if (!collection) return

  const today = localDateKey(new Date())
  const nextWorkout = collection.scheduleEntries.find(
    (entry) => localDateKey(entry.date) >= today && entry.workout && !entry.isCompleted,
  )?.workout
  const workoutById = new Map(collection.workouts.map((workout) => [workout.id, workout]))
  if (collection.todayWorkout) workoutById.set(collection.todayWorkout.id, collection.todayWorkout)
  if (nextWorkout) workoutById.set(nextWorkout.id, nextWorkout)

  const ids = new Set([
    ...collection.activeSessions.map((active) => active.workoutId),
    collection.todayWorkout?.id,
    nextWorkout?.id,
  ].filter((id): id is string => Boolean(id)))

  await Promise.all([...ids].map(async (workoutId) => {
    let workout = workoutById.get(workoutId)
    if (!workout) {
      workout = await queryClient.fetchQuery({
        queryFn: async () => fetchWorkoutDetail(await requireAccessToken(), workoutId),
        queryKey: userQueryKey(queryKeys.workouts.detail(workoutId), userId),
        staleTime: 30_000,
      })
    } else {
      queryClient.setQueryData(
        userQueryKey(queryKeys.workouts.detail(workoutId), userId),
        (current: Workout | undefined) => current ?? workout,
      )
    }
    if (!workout) return

    await Promise.allSettled([
      saveOfflineWorkoutSnapshot(userId, workout),
      warmOfflineWorkoutRoute(workoutId),
    ])
  }))
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

// Draft writes go through the offline queue (lib/offline/sync.ts), not mutations.

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

/**
 * Copies a day out of an assigned program into the trainee's own routines.
 *
 * Invalidates the whole training set rather than one workout: the copy is a new
 * program of its own, so the routines list and schedule both gain an entry.
 */
export function useDuplicateWorkoutToRoutine() {
  const invalidateTrainingData = useInvalidateTrainingData()

  return useMutation({
    mutationFn: async (workoutId: string) => duplicateWorkoutToRoutine(await requireAccessToken(), workoutId),
    onSuccess: () => invalidateTrainingData(),
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
