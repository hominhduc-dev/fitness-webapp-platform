"use client"

import type { DashboardAnalytics } from "@/lib/fitness/types"
import { useLocale } from "@/components/providers/locale-provider"
import { SummaryCards } from "./summary-cards"
import { WorkoutFrequencyChart } from "./workout-frequency-chart"
import { TrainingVolumeChart } from "./training-volume-chart"
import { BodyProgressChart } from "./body-progress-chart"
import { MuscleDistributionChart } from "./muscle-distribution-chart"
import { PrFeed } from "./pr-feed"

export function AnalyticsDashboard({ data }: { data: DashboardAnalytics }) {
  const { messages } = useLocale()
  const copy = messages.progressPage.analytics
  return (
    <div className="space-y-10">
      <SummaryCards summary={data.summary} />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium">{copy.frequency}</h2>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" />{copy.completedLegend}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-border" />{copy.plannedLegend}</span>
            </div>
          </div>
          <WorkoutFrequencyChart data={data.workoutFrequency} />
        </section>
        <section className="min-w-0">
          <div className="mb-6 flex items-center justify-between"><h2 className="text-sm font-medium">{copy.volume}</h2><span className="text-xs text-muted-foreground">kg</span></div>
          <TrainingVolumeChart data={data.trainingVolume} />
        </section>
      </div>
      <div className="grid gap-10 border-t border-border pt-8 lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0">
          <h2 className="mb-6 text-sm font-medium">{copy.body}</h2>
          {data.bodyProgress.weight.length ? <BodyProgressChart data={data.bodyProgress} /> : <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">{copy.empty}</p>}
        </section>
        <section className="min-w-0">
          <h2 className="mb-6 text-sm font-medium">{copy.muscles}</h2>
          <MuscleDistributionChart data={data.muscleGroupDistribution} />
        </section>
      </div>
      <section className="border-t border-border pt-8">
        <h2 className="mb-5 text-sm font-medium">{copy.recent}</h2>
        <PrFeed prs={data.recentPRs} />
      </section>
    </div>
  )
}
