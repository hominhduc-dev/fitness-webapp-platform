"use client"

import { useEffect } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { startOfflineSync } from "@/lib/offline/sync"

/**
 * Drains the signed-in trainee's offline queue. Queued records carry their
 * owner, so switching accounts stops one user's queue before the next starts;
 * nothing is ever sent with another user's token.
 */
export function OfflineSyncManager() {
  const { profile } = useAuth()
  const userId = profile?.role === "trainee" ? profile.id : null

  useEffect(() => {
    if (!userId) return
    return startOfflineSync(userId)
  }, [userId])

  return null
}
