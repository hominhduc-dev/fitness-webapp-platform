"use client"

import Link from "next/link"
import { Activity, ChevronRight, Dumbbell, Moon } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { formatReadinessScore, readinessRingProgress } from "@/lib/fitness/readiness"
import { useVolumeRecovery } from "@/lib/queries/progress"

function ReadinessRing({ score }: { score: number | null }) {
  const circumference = 2 * Math.PI * 42

  return (
    <div className="relative size-32 shrink-0 text-primary">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - readinessRingProgress(score))}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-semibold tnum text-foreground">{formatReadinessScore(score)}</span>
      </span>
    </div>
  )
}

export function ReadinessCard() {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const dashboardCopy = messages.dashboard
  const query = useVolumeRecovery()
  const data = query.data

  if (query.isPending) {
    return <Skeleton className="min-h-[320px] rounded-3xl" />
  }

  const readinessLabel = data?.readiness.label === "ready"
    ? copy.ready
    : data?.readiness.label === "moderate"
      ? copy.moderate
      : data?.readiness.label === "low"
        ? copy.low
        : copy.insufficient
  const highestSoreness = data?.checkIn?.muscles.length
    ? Math.max(...data.checkIn.muscles.map((muscle) => muscle.soreness))
    : null
  const insight = data?.muscles.find((muscle) => muscle.recommendation.action !== "maintain")
    ?? data?.muscles[0]
    ?? null

  return (
    <section className="glass-card min-w-0 rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{copy.readiness}</h2>
        <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {dashboardCopy.viewDetails}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center">
          <ReadinessRing score={data?.readiness.score ?? null} />
          <p className="mt-1 text-center text-sm font-semibold text-primary">{readinessLabel}</p>
          <p className="font-mono text-micro tnum text-muted-foreground">{copy.resultScale}</p>
        </div>

        <div className="min-w-0 flex-1 divide-y divide-border">
          {[
            {
              icon: Moon,
              label: copy.sleep,
              value: data?.checkIn?.sleepMinutes != null
                ? `${Math.floor(data.checkIn.sleepMinutes / 60)}h ${data.checkIn.sleepMinutes % 60}m`
                : "—",
            },
            { icon: Activity, label: copy.fatigue, value: data?.checkIn ? `${data.checkIn.fatigue}/5` : "—" },
            { icon: Dumbbell, label: copy.soreness, value: highestSoreness == null ? "—" : `${highestSoreness}/5` },
          ].map((signal) => (
            <div key={signal.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                <signal.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">{signal.label}</span>
              <span className="font-mono text-sm font-semibold tnum text-foreground">{signal.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-primary-soft p-4">
        <p className="text-sm font-semibold text-primary">{copy.coachInsight}</p>
        <p className="mt-1 text-sm leading-6 text-foreground">
          {insight
            ? copy.recommendation(
                insight.recommendation.action,
                copy.muscleLabels[insight.muscleSlug as keyof typeof copy.muscleLabels] ?? insight.muscleSlug,
              )
            : dashboardCopy.checkInForInsight}
        </p>
      </div>
    </section>
  )
}
