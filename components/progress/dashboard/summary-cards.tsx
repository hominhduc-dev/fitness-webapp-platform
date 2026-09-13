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
    <dl className="grid grid-cols-2 gap-y-6 border-y border-border py-6 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`min-w-0 px-4 first:pl-0 sm:px-6 ${index % 2 === 1 ? "border-l border-border" : "lg:border-l lg:border-border"}`}>
          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
          <dd className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-3xl font-medium tabular-nums tracking-tight xl:text-4xl">
            {metric.value}<span className="text-sm font-normal tracking-normal text-muted-foreground">{metric.unit}</span>
          </dd>
          <dd className="mt-2 truncate text-xs text-muted-foreground" title={metric.detail}>{metric.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
