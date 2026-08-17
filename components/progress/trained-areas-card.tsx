"use client"

import { useMemo, useState } from "react"

import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { useLocale } from "@/components/providers/locale-provider"
import { startOfUtcWeek } from "@/lib/fitness/date-range"
import { buildMuscleHighlights, muscleGroupsFromLogs } from "@/lib/fitness/muscle-map"
import type { WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"

type Period = "this" | "last"

interface TrainedAreasCardProps {
  /**
   * Every session since Monday 00:00 UTC. Served unbounded by /api/workouts, so
   * this is complete for the current week.
   */
  weekLogs: WorkoutLog[]
  /**
   * The 20 most recent sessions, which is where last week's come from — the
   * calendar endpoint returns log stubs without exercises, so it cannot answer
   * this. Twenty sessions covers roughly four to six weeks of normal training;
   * only someone logging more than 20 sessions inside a fortnight would see
   * last week clipped.
   */
  historyLogs: WorkoutLog[]
}

export function TrainedAreasCard({ weekLogs, historyLogs }: TrainedAreasCardProps) {
  const { messages } = useLocale()
  const [period, setPeriod] = useState<Period>("this")

  const lastWeekLogs = useMemo(() => {
    // Same Monday-UTC boundary the backend used to cut weekLogs, so the two
    // periods abut exactly instead of overlapping or leaving a gap.
    const thisWeekStart = startOfUtcWeek(new Date()).getTime()
    const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000

    return historyLogs.filter((log) => {
      const startedAt = new Date(log.startedAt).getTime()
      return startedAt >= lastWeekStart && startedAt < thisWeekStart
    })
  }, [historyLogs])

  const logs = period === "this" ? weekLogs : lastWeekLogs
  const highlights = useMemo(
    () => buildMuscleHighlights(muscleGroupsFromLogs(logs), "var(--primary)"),
    [logs],
  )

  const periods: { key: Period; label: string }[] = [
    { key: "this", label: messages.progressPage.thisWeek },
    { key: "last", label: messages.progressPage.lastWeek },
  ]

  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="label-micro">{messages.progressPage.trainedAreas}</p>
        <div className="flex gap-1.5">
          {periods.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={cn(
                "inline-flex h-7 pointer-coarse:h-9 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
                period === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {logs.length > 0 ? (
        <MuscleMapPair
          highlights={highlights}
          label={messages.progressPage.trainedAreasLabel}
          className="py-1"
        />
      ) : (
        <div className="flex min-h-[8rem] items-center justify-center rounded-[8px] border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
          {messages.progressPage.noTrainedAreas}
        </div>
      )}
    </div>
  )
}
