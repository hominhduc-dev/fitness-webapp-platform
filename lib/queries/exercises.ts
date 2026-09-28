"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { coachExerciseToVariationOption, createCoachExerciseRequest, fetchExercises } from "@/lib/fitness/api"
import type { CoachExerciseInput } from "@/lib/fitness/types"
import { queryKeys } from "@/lib/queries/keys"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import type { ExerciseQueryOptions } from "@/lib/queries/types"

export function useExercises(filters?: ExerciseQueryOptions, initialData?: Awaited<ReturnType<typeof fetchExercises>>, enabled = true) {
  return useUserQuery({ queryKey: queryKeys.exercises.list(filters),
    queryFn: async () => fetchExercises(await requireAccessToken(), filters),
    initialData, enabled, staleTime: 30 * 60_000 })
}

/**
 * A coach creates an exercise from a picker and gets it back as a pickable
 * option. Both the pickers' catalogue and the coach's library refetch, so the
 * new exercise is there the next time either opens.
 */
export function useCreateExerciseFromPicker() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: CoachExerciseInput) => {
      const option = coachExerciseToVariationOption(await createCoachExerciseRequest(await requireAccessToken(), input))
      if (!option) throw new Error("The new exercise has no variation to pick.")
      return option
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.exercises.all }),
        client.invalidateQueries({ queryKey: ["coach", "exercises"] }),
      ]),
  })
}
