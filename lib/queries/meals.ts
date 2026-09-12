"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useUserQuery as useQuery, userQueryKey } from "./scoped"

import { useAuth } from "@/components/providers/auth-provider"
import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import { addMealItem, createCustomFood, deleteMealItem, fetchFoods, fetchNutritionDay } from "@/lib/fitness/api"
import type { NutritionFood } from "@/lib/types"
type NutritionDay = Awaited<ReturnType<typeof fetchNutritionDay>>

/** Meal logging is bursty and the mutations invalidate precisely; this is a backstop. */
const NUTRITION_STALE_TIME_MS = 30_000
/** The food catalogue only grows when this user adds a custom food. */
const FOODS_STALE_TIME_MS = 30 * 60_000

export function useNutritionDay(dateKey: string, seed?: { initialData?: NutritionDay }) {
  return useQuery({
    queryKey: queryKeys.meals.nutritionDay(dateKey),
    queryFn: async () => fetchNutritionDay(await requireAccessToken(), dateKey),
    initialData: seed?.initialData,
    staleTime: NUTRITION_STALE_TIME_MS,
  })
}

export function useFoods(
  options?: { category?: string; query?: string },
  seed?: { initialData?: NutritionFood[] },
) {
  return useQuery({
    queryKey: queryKeys.meals.foods(options),
    queryFn: async () => fetchFoods(await requireAccessToken(), options),
    initialData: seed?.initialData,
    staleTime: FOODS_STALE_TIME_MS,
  })
}

/**
 * The three write hooks below all return the updated `Meal`, which the caller
 * writes straight into the cached day. Invalidating alone would make each add or
 * delete wait for a full day refetch and feel slower than the local splice this
 * replaces, so the cache is patched first and revalidated after.
 */
function useMealDayWriteback() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return {
    userId: profile?.id,
    patchDay: (dateKey: string, userId: string | undefined, updater: (day: NutritionDay) => NutritionDay) => {
      if (profile?.id !== userId) return
      queryClient.setQueryData<NutritionDay>(userQueryKey(queryKeys.meals.nutritionDay(dateKey), userId), (current) =>
        current ? updater(current) : current,
      )
    },
    revalidate: (dateKey: string) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meals.nutritionDay(dateKey) })
      void queryClient.invalidateQueries({ queryKey: ["workouts", "dashboard"] })
    },
  }
}

export function useAddMealItem(dateKey: string) {
  const { patchDay, revalidate, userId } = useMealDayWriteback()

  return useMutation({
    mutationFn: async (input: Parameters<typeof addMealItem>[1]) =>
      addMealItem(await requireAccessToken(), input),
    onMutate: (input) => ({ dateKey: input.date ?? dateKey, userId }),
    onSuccess: (meal, _input, context) => {
      if (!context) return
      patchDay(context.dateKey, context.userId, (day) => replaceMealInDay(day, meal))
      revalidate(context.dateKey)
    },
  })
}

export function useDeleteMealItem(dateKey: string) {
  const { patchDay, revalidate, userId } = useMealDayWriteback()

  return useMutation({
    mutationFn: async (itemId: string) => deleteMealItem(await requireAccessToken(), itemId),
    onMutate: () => ({ dateKey, userId }),
    onSuccess: (meal, _input, context) => {
      if (!context) return
      patchDay(context.dateKey, context.userId, (day) => replaceMealInDay(day, meal))
      revalidate(context.dateKey)
    },
  })
}

export function useCreateCustomFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Parameters<typeof createCustomFood>[1]) =>
      createCustomFood(await requireAccessToken(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.meals.all, "foods"] })
    },
  })
}

function replaceMealInDay(day: NutritionDay, meal: NutritionDay["meals"][number]): NutritionDay {
  const meals = day.meals.some((current) => current.type === meal.type)
    ? day.meals.map((current) => current.type === meal.type ? meal : current)
    : [...day.meals, meal]
  const totals = meals.reduce((sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + (item.protein ?? 0),
    carbs: sum.carbs + (item.carbs ?? 0),
    fat: sum.fat + (item.fat ?? 0),
    fiber: sum.fiber + (item.fiber ?? 0),
    sugar: sum.sugar + (item.sugar ?? 0),
    sodium: sum.sodium + (item.sodium ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 })
  return {
    ...day,
    meals,
    totals,
  }
}
