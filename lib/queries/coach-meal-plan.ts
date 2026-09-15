"use client"

import {
  deleteCoachTraineeMealItem,
  fetchCoachTraineeMealPlan,
  reviewCoachTraineeMealPlan,
  updateCoachTraineeMealItem,
} from "@/lib/fitness/api"
import { useCoachData, useCoachMutation } from "@/lib/queries/coach-data"

/** Coach writes invalidate the whole "coach" domain, which refreshes this plan too. */
export function useCoachTraineeMealPlan(traineeId: string, date: string) {
  return useCoachData(
    ["coach", "trainee-meal-plan", traineeId, date],
    (token) => fetchCoachTraineeMealPlan(token, traineeId, date),
    undefined,
    true,
    30_000,
  )
}

export function useUpdateCoachTraineeMealItem() {
  return useCoachMutation(updateCoachTraineeMealItem, ["coach"])
}

export function useDeleteCoachTraineeMealItem() {
  return useCoachMutation(deleteCoachTraineeMealItem, ["coach"])
}

export function useReviewCoachTraineeMealPlan() {
  return useCoachMutation(reviewCoachTraineeMealPlan, ["coach"])
}
