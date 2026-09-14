"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { VolumeLandmarkBar, volumeZoneClass } from "@/components/progress/volume-recovery/volume-landmark-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { useVolumeRecovery } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

// Enough rows to show where the week is unbalanced, few enough to stay a glance.
const VISIBLE_MUSCLES = 5

export function WeeklyVolumeCard() {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const dashboardCopy = messages.dashboard
  const query = useVolumeRecovery()

  if (query.isPending) {
    return <Skeleton className="min-h-[220px] rounded-3xl" />
  }

  const muscles = query.data?.muscles.slice(0, VISIBLE_MUSCLES) ?? []

  return (
    <section className="glass-card h-full min-w-0 rounded-2xl border border-border bg-card p-3.5 lg:p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{copy.weeklyVolume}</h2>
        <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {dashboardCopy.viewDetails}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {muscles.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{copy.noVolume}</p>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2 lg:gap-1.5">
          {muscles.map((muscle) => (
            <div key={muscle.muscleSlug} className="min-w-0 lg:grid lg:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-3">
              <div className="mb-1 flex items-baseline justify-between gap-3 lg:contents">
                <span className="min-w-0 truncate text-sm font-medium text-foreground lg:col-start-1">
                  {copy.muscleLabels[muscle.muscleSlug as keyof typeof copy.muscleLabels] ?? muscle.muscleSlug}
                </span>
                <span className="flex shrink-0 items-center gap-2 lg:col-start-3">
                  <span className="font-mono text-sm font-semibold tnum text-foreground">{muscle.effectiveSets}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-micro font-medium", volumeZoneClass(muscle.zone))}>
                    {copy.zones[muscle.zone]}
                  </span>
                </span>
              </div>
              <VolumeLandmarkBar
                className="lg:col-start-2 lg:row-start-1"
                landmarks={muscle.landmarks}
                sets={muscle.effectiveSets}
                showTicks={false}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
