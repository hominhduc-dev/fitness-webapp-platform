"use client"

import { useEffect } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { scheduleIdle } from "@/lib/idle"
import { warmOfflineRoute } from "@/lib/offline/service-worker"

/**
 * The trainee screens the worker is allowed to keep. They are reachable inside
 * the app only through client-side navigation, which never produces a document
 * for the worker to cache, so each one is fetched here instead.
 */
const TRAINEE_OFFLINE_ROUTES = ["/dashboard", "/workout", "/schedule", "/meals", "/progress", "/trackweight"]

/**
 * Pins the trainee's offline shell once per launch, on idle.
 *
 * Warming is sequential: six authenticated page loads at once would compete
 * with whatever the trainee actually opened the app to do, and there is no
 * deadline — the copies only matter on some later launch without signal.
 */
export function OfflineRouteWarmer() {
  const isTrainee = useAuth().profile?.role === "trainee"

  useEffect(() => {
    if (!isTrainee) return

    let cancelled = false
    let cancelIdle: (() => void) | null = null

    const warmAll = async () => {
      for (const route of TRAINEE_OFFLINE_ROUTES) {
        if (cancelled || navigator.onLine === false) return
        await warmOfflineRoute(route).catch(() => false)
      }
    }

    const schedule = () => {
      if (navigator.onLine === false) return
      cancelIdle?.()
      cancelIdle = scheduleIdle(() => {
        void warmAll()
      })
    }

    schedule()
    // A session that started without signal still gets its shell once the
    // network returns, rather than waiting for the next launch.
    window.addEventListener("online", schedule)

    return () => {
      cancelled = true
      cancelIdle?.()
      window.removeEventListener("online", schedule)
    }
  }, [isTrainee])

  return null
}
