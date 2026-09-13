"use client"

import type { DashboardAnalytics } from "@/lib/fitness/types"
import { SummaryCards } from "./summary-cards"
import { WorkoutFrequencyChart } from "./workout-frequency-chart"
import { TrainingVolumeChart } from "./training-volume-chart"
import { BodyProgressChart } from "./body-progress-chart"
import { MuscleDistributionChart } from "./muscle-distribution-chart"
import { PrFeed } from "./pr-feed"

export function AnalyticsDashboard({ data }: { data: DashboardAnalytics }) {
  return (
    <div className="space-y-6">
      <SummaryCards summary={data.summary} />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium">Workout Frequency</h3>
          <WorkoutFrequencyChart data={data.workoutFrequency} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium">Training Volume</h3>
          <TrainingVolumeChart data={data.trainingVolume} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium">Body Progress</h3>
          <BodyProgressChart data={data.bodyProgress} />
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-medium">Muscle Distribution</h3>
            <MuscleDistributionChart data={data.muscleGroupDistribution} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Recent PRs</h3>
            </div>
            <PrFeed prs={data.recentPRs} />
          </div>
        </div>
      </div>
    </div>
  )
}
