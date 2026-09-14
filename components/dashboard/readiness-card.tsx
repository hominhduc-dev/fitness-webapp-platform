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
    <div className="relative size-20 shrink-0 text-primary lg:size-24 xl:size-26">
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
        <span className="text-2xl font-semibold leading-none tnum text-foreground">{formatReadinessScore(score)}</span>
        <span className="mt-1 text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  )
}

function formatSleepDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function ReadinessCard() {
  const { messages } = useLocale()
  const copy = messages.dashboard
  const query = useVolumeRecovery()
  const data = query.data

  if (query.isPending) {
    return <Skeleton className="min-h-[13.5rem] rounded-3xl lg:min-h-40" />
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
    <section className="glass-card flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-3">
      <Link
        href="/progress?tab=volume"
        className="-m-1 flex items-center justify-between gap-3 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h2 className="text-base font-semibold text-foreground">{copy.todaysReadiness}</h2>
        <ChevronRight className="size-4 text-foreground" aria-hidden="true" />
        <span className="sr-only">{copy.viewDetails}</span>
      </Link>

      <div className="mt-2.5 flex items-center gap-3">
        <ReadinessRing label={copy.readinessShort[labelKey]} score={data?.readiness.score ?? null} />

        <ul className="min-w-0 flex-1 space-y-1.5">
          {metrics.map((metric) => (
            <li key={metric.label} className="flex min-w-0 items-center gap-2 text-sm">
              <metric.icon className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{metric.label}</span>
              <span className="shrink-0 font-mono text-xs font-semibold tnum text-foreground">{metric.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
