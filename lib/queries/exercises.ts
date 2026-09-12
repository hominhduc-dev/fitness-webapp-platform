"use client"

import { fetchExercises, fetchExerciseLibrary } from "@/lib/fitness/api"
import { queryKeys } from "@/lib/queries/keys"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import type { ExerciseQueryOptions } from "@/lib/queries/types"

export function useExercises(filters?: ExerciseQueryOptions, initialData?: Awaited<ReturnType<typeof fetchExercises>>, enabled = true) {
  return useUserQuery({ queryKey: queryKeys.exercises.list(filters),
    queryFn: async () => fetchExercises(await requireAccessToken(), filters),
    initialData, enabled, staleTime: 30 * 60_000 })
}

export function useExerciseLibrary(filters?: ExerciseQueryOptions, initialData?: Awaited<ReturnType<typeof fetchExerciseLibrary>>, enabled = true) {
  return useUserQuery({ queryKey: queryKeys.exercises.library(filters),
    queryFn: async () => fetchExerciseLibrary(await requireAccessToken(), filters),
    initialData, enabled, staleTime: 30 * 60_000 })
}
