"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { prefetchMeals } from "@/lib/queries/meals"
import { prefetchWorkouts } from "@/lib/queries/workouts"

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function TraineeRoutePrefetch({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    const warmRouteData = () => {
      if (cancelled) return
      const today = formatDateKey(new Date())
      void Promise.all([
        prefetchWorkouts(queryClient, userId),
        prefetchMeals(queryClient, userId, today),
      ])
    }

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(warmRouteData, { timeout: 1_500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = globalThis.setTimeout(warmRouteData, 250)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [queryClient, userId])

  return null
}
