"use client"

import type { DashboardAnalyticsSummary } from "@/lib/fitness/types"
import { useLocale } from "@/components/providers/locale-provider"

export function SummaryCards({ summary }: { summary: DashboardAnalyticsSummary }) {
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.analytics
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const signed = (value: number) => `${value > 0 ? "+" : ""}${number.format(value)}`
  const metrics = [
    { label: copy.completed, value: number.format(summary.completedWorkouts), detail: `${summary.plannedWorkouts} ${copy.planned}` },
    { label: copy.volume, value: number.format(summary.totalVolume), unit: "kg", detail: `${signed(summary.volumeDeltaPct)}% ${copy.comparison}` },
    { label: copy.strength, value: `${signed(summary.e1rmChangePct)}%`, detail: `${signed(summary.e1rmChangeTotalKg)} kg ${copy.comparison}` },
    { label: copy.records, value: number.format(summary.newPRsCount), detail: summary.latestPR?.exerciseName ?? copy.noRecords },
  ]
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-4">
          <dt className="truncate text-xs text-muted-foreground">{metric.label}</dt>
          <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {metric.value}
            {metric.unit ? <span className="text-xs font-normal tracking-normal text-muted-foreground">{metric.unit}</span> : null}
          </dd>
          <dd className="mt-1 truncate text-xs text-muted-foreground" title={metric.detail}>{metric.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
