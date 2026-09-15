"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { scheduleIdle } from "@/lib/idle"
import { prefetchCoachRoutes } from "@/lib/queries/coach-data"

/** Fills the cache for Clients, Programs, Exercises and Stats while the shell is idle. */
export function CoachRoutePrefetch({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  useEffect(() => scheduleIdle(() => {
    void prefetchCoachRoutes(queryClient, userId)
  }), [queryClient, userId])

  return null
}
