"use client"

import Link from "next/link"
import { Activity, ChevronRight, Heart, Moon, Zap } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { formatReadinessScore, readinessRingProgress } from "@/lib/fitness/readiness"
import { useVolumeRecovery } from "@/lib/queries/progress"

const READINESS_LABELS = ["ready", "moderate", "low"] as const

function ReadinessRing({ label, score }: { label: string; score: number | null }) {
  const circumference = 2 * Math.PI * 42

  return (
    <div className="relative size-14 shrink-0 self-center text-primary sm:size-20 sm:self-auto lg:size-24 xl:size-26">
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
        <span className="text-base font-semibold leading-none tnum text-foreground sm:text-2xl">{formatReadinessScore(score)}</span>
        <span className="mt-0.5 text-[10px] leading-none text-muted-foreground sm:mt-1 sm:text-xs">{label}</span>
      </span>
    </div>
  )
}

function formatSleepDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * Phones show this card as a square beside the nutrition card, so below `sm`
 * the ring shrinks and the four signals become a 2×2 grid of icon + value.
 * The signal names stay in the markup for screen readers and tooltips.
 */
export function ReadinessCard() {
  const { messages } = useLocale()
  const copy = messages.dashboard
  const query = useVolumeRecovery()
  const data = query.data

  if (query.isPending) {
    return <Skeleton className="aspect-square rounded-2xl sm:aspect-auto sm:min-h-40" />
  }

  const labelKey = READINESS_LABELS.find((label) => label === data?.readiness.label) ?? "insufficient"
  const checkIn = data?.checkIn ?? null
  const maxSoreness = checkIn?.muscles.length ? Math.max(...checkIn.muscles.map((muscle) => muscle.soreness)) : null

  const metrics = [
    {
      icon: Moon,
      label: messages.volumeRecovery.sleep,
      value: checkIn?.sleepMinutes == null ? "—" : formatSleepDuration(checkIn.sleepMinutes),
    },
    {
      icon: Zap,
      label: messages.volumeRecovery.fatigue,
      value: checkIn?.fatigue == null ? "—" : `${checkIn.fatigue}/5`,
    },
    {
      icon: Heart,
      label: messages.volumeRecovery.stress,
      value: checkIn?.stress == null ? "—" : `${checkIn.stress}/5`,
    },
    {
      icon: Activity,
      label: messages.volumeRecovery.soreness,
      value: maxSoreness == null ? "—" : `${maxSoreness}/5`,
    },
  ]

  return (
    <section className="glass-card flex aspect-square min-w-0 flex-col rounded-2xl border border-border bg-card p-3 sm:aspect-auto sm:h-full">
      <Link
        href="/progress?tab=volume"
        className="-m-1 flex items-center justify-between gap-2 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">
          <span className="sm:hidden">{messages.volumeRecovery.readiness}</span>
          <span className="hidden sm:inline">{copy.todaysReadiness}</span>
        </h2>
        <ChevronRight className="size-4 shrink-0 text-foreground" aria-hidden="true" />
        <span className="sr-only">{copy.viewDetails}</span>
      </Link>

      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-between gap-2 sm:mt-2.5 sm:flex-none sm:flex-row sm:items-center sm:justify-start sm:gap-3">
        <ReadinessRing label={copy.readinessShort[labelKey]} score={data?.readiness.score ?? null} />

        <ul className="grid grid-cols-2 gap-1 sm:block sm:min-w-0 sm:flex-1 sm:space-y-1.5">
          {metrics.map((metric) => (
            <li
              key={metric.label}
              title={metric.label}
              className="flex min-w-0 items-center gap-1 rounded-lg bg-surface-subtle px-1.5 py-1 text-sm sm:gap-2 sm:rounded-none sm:bg-transparent sm:p-0"
            >
              <metric.icon className="size-3.5 shrink-0 text-primary sm:size-4" strokeWidth={2} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:min-w-0 sm:flex-1 sm:truncate sm:text-muted-foreground">{metric.label}</span>
              <span className="ml-auto shrink-0 truncate font-mono text-[11px] font-semibold tnum text-foreground sm:ml-0 sm:text-xs">
                {metric.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
