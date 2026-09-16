"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useActiveWorkoutSessions } from "@/lib/queries/workouts"
import {
  type ActiveWorkoutSession,
  WORKOUT_SESSION_STORAGE_PREFIX,
  reconcileActiveSessions,
} from "@/lib/workout/session-storage"

/**
 * In-progress workout sessions from the server, plus sessions only cached on this
 * device. Local copies discarded on another device are dropped once a fresh server
 * list confirms they are gone. `fallback` (e.g. SSR dashboard data) is shown until
 * the server list loads.
 */
export function useActiveWorkoutSessionList(fallback?: ActiveWorkoutSession[]) {
  const query = useActiveWorkoutSessions()
  const [scannedSessions, setScannedSessions] = useState<ActiveWorkoutSession[]>([])

  // Only a fresh response may prune local copies: cached data from before this
  // device synced its own session would otherwise delete that session.
  const isAuthoritative = query.isSuccess && !query.isFetching && !query.isStale
  const serverSessions = query.data

  const refresh = useCallback(() => {
    if (isAuthoritative) {
      setScannedSessions(reconcileActiveSessions(serverSessions ?? []))
      return
    }
    const known = serverSessions ?? []
    const knownIds = new Set(known.map((session) => session.workoutId))
    setScannedSessions([
      ...known,
      ...reconcileActiveSessions(null).filter((session) => !knownIds.has(session.workoutId)),
    ])
  }, [isAuthoritative, serverSessions])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Cross-tab sync: rescan when any workout-session key changes.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(`${WORKOUT_SESSION_STORAGE_PREFIX}:`)) {
        refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  const sessions = useMemo(() => {
    if (serverSessions !== undefined || !fallback?.length) return scannedSessions
    const fallbackIds = new Set(fallback.map((session) => session.workoutId))
    return [...fallback, ...scannedSessions.filter((session) => !fallbackIds.has(session.workoutId))]
  }, [fallback, scannedSessions, serverSessions])

  return { refresh, sessions }
}
