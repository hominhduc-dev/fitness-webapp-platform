"use client"

import { MetricCard } from "@/components/ui/metric-card"
import type { DashboardAnalyticsSummary } from "@/lib/fitness/types"
import { CalendarCheck, Dumbbell, TrendingUp, Trophy } from "lucide-react"

export function SummaryCards({ summary }: { summary: DashboardAnalyticsSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Completed Workouts"
        value={`${summary.completedWorkouts} / ${summary.plannedWorkouts}`}
        subtitle={`${summary.completedDelta >= 0 ? "+" : ""}${summary.completedDelta} sessions vs last month`}
        progress={summary.completionRate}
        icon={CalendarCheck}
        variant="featured"
        tone="success"
      />
      <MetricCard
        title="Total Volume"
        value={`${summary.totalVolume.toLocaleString()} kg`}
        subtitle="vs last month"
        trend={{ value: summary.volumeDeltaPct, positive: summary.volumeDeltaPct >= 0 }}
        icon={Dumbbell}
        variant="featured"
        tone="violet"
      />
      <MetricCard
        title="Strength (e1RM)"
        value={`${summary.e1rmChangePct >= 0 ? "+" : ""}${summary.e1rmChangePct}%`}
        subtitle={`${summary.e1rmChangeTotalKg >= 0 ? "+" : ""}${summary.e1rmChangeTotalKg} kg (total) vs last month`}
        icon={TrendingUp}
        variant="featured"
        tone="primary"
      />
      <MetricCard
        title="New PRs"
        value={summary.newPRsCount.toString()}
        subtitle={summary.latestPR ? `${summary.latestPR.exerciseName} +${summary.latestPR.deltaKg}kg` : "No recent PRs"}
        icon={Trophy}
        variant="featured"
        tone="warning"
      />
    </div>
  )
}
