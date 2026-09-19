"use client"

import Link from "next/link"
import { ChevronRight, Info } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { VolumeLandmarkBar, volumeZoneClass } from "@/components/progress/volume-recovery/volume-landmark-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { BottomSheet, BottomSheetBody, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { useVolumeRecovery } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

// Enough rows to show where the week is unbalanced, few enough to stay a glance.
const VISIBLE_MUSCLES = 5

export function WeeklyVolumeCard() {
  const { locale, messages } = useLocale()
  const copy = messages.volumeRecovery
  const dashboardCopy = messages.dashboard
  const query = useVolumeRecovery()
  const [metricsOpen, setMetricsOpen] = useState(false)

  if (query.isPending) {
    return <Skeleton className="min-h-[220px] rounded-3xl" />
  }

  const muscles = query.data?.muscles.slice(0, VISIBLE_MUSCLES) ?? []

  return (
    <>
      <section className="glass-card h-full min-w-0 rounded-2xl border border-border bg-card p-3.5 lg:p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-semibold text-foreground">{copy.weeklyVolume}</h2>
            <button
              type="button"
              aria-label={locale === "vi" ? "Giải thích chỉ số tập luyện" : "Explain training metrics"}
              title={locale === "vi" ? "Giải thích chỉ số tập luyện" : "Explain training metrics"}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMetricsOpen(true)}
            >
              <Info className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
            {query.data?.summary.hardSets ?? 0} {copy.hardSets} · {copy.avgRir} {query.data?.summary.averageRir ?? "—"}
          </p>
        </div>
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

      {metricsOpen ? (
        <BottomSheet
          ariaLabel={locale === "vi" ? "Chỉ số tập luyện" : "Training metrics"}
          onClose={() => setMetricsOpen(false)}
          variant="flush"
        >
          <BottomSheetHeader>
            <div>
              <h2 className="text-base font-semibold text-foreground">{copy.trainingMetrics.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.trainingMetrics.description}</p>
            </div>
          </BottomSheetHeader>
          <BottomSheetBody>
            <div className="space-y-4">
              {[
                ["Hard set", "Hard set", copy.trainingMetrics.hardSet],
                ["MEV", "Minimum Effective Volume", copy.trainingMetrics.mev],
                ["MAV", "Maximum Adaptive Volume", copy.trainingMetrics.mav],
                ["MRV", "Maximum Recoverable Volume", copy.trainingMetrics.mrv],
                ["e1RM", "Estimated 1 Rep Max", copy.trainingMetrics.e1rm],
              ].map(([term, title, description], index) => (
                <div key={term} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-micro font-semibold text-muted-foreground" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{term} · {title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </BottomSheetBody>
        </BottomSheet>
      ) : null}
    </>
  )
}
