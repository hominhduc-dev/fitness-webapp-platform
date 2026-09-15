"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { scheduleIdle } from "@/lib/idle"
import { prefetchMeals } from "@/lib/queries/meals"
import { prefetchWorkouts } from "@/lib/queries/workouts"

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function TraineeRoutePrefetch({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  useEffect(() => scheduleIdle(() => {
    const today = formatDateKey(new Date())
    void Promise.all([
      prefetchWorkouts(queryClient, userId),
      prefetchMeals(queryClient, userId, today),
    ])
  }), [queryClient, userId])

  return null
}
