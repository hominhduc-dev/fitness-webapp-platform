"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { consumeDashboardRefreshFlag } from "@/lib/fitness/dashboard-refresh"

export function DashboardRefreshOnStale() {
  const router = useRouter()

  useEffect(() => {
    if (!consumeDashboardRefreshFlag()) {
      return
    }

    router.refresh()
  }, [router])

  return null
}
