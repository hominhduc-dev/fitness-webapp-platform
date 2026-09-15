"use client"

import { MetricCard } from "@/components/ui/metric-card"
import { useLocale } from "@/components/providers/locale-provider"
import { useCoachNavCounts } from "@/lib/queries/coach-data"

/** Reads the same cached counts as the sidebar badges, so it renders without a request. */
export function CoachStatsCards() {
  const { messages } = useLocale()
  const { data: counts } = useCoachNavCounts()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MetricCard title={messages.shell.clients} value={counts?.trainees ?? "—"} tone="primary" />
      <MetricCard title={messages.shell.programs} value={counts?.programs ?? "—"} tone="success" />
    </div>
  )
}
