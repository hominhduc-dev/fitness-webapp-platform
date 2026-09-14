"use client"

import type React from "react"
import { useMemo } from "react"
import { Activity, ChevronRight, Dumbbell, Flame, Moon, Scale, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { calculateLeanMassKg, convertWeightFromKg, formatSignedWeight, formatWeight, type WeightUnit } from "@/lib/fitness/weight"
import { useProgressAnalytics, useRecoveryHistory, useVolumeRecovery, useWeightEntries } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const WEIGHT_RANGE_DAYS = 90

type WeightPoint = { label: string; value: number }

function StatTile({
  className,
  icon: Icon,
  label,
  value,
}: {
  className?: string
  icon: typeof Flame
  label: string
  value: string
}) {
  return (
    <div className={cn("min-w-0 px-1 text-center sm:px-2", className)}>
      <Icon className="mx-auto size-5 text-primary sm:size-4" aria-hidden="true" />
      <p className="mt-2 truncate font-mono text-lg font-semibold tnum text-foreground sm:text-lg">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-micro">{label}</p>
    </div>
  )
}

function CardTitle({
  action,
  children,
}: {
  action?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-base">{children}</h2>
      {action ? (
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary"
        >
          {action}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)

  return (
    <div className="flex h-20 items-end gap-2" aria-hidden="true">
      {values.map((value, index) => (
        <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className="w-full rounded-t-md bg-primary opacity-80"
            style={{ height: `${Math.max(18, (value / max) * 64)}px` }}
          />
          <span className="font-mono text-[10px] leading-none text-muted-foreground">
            {"MTWTFSS"[index]}
          </span>
        </div>
      ))}
    </div>
  )
}

/** A signed figure reads as progress or regression, so it carries a tone. */
function DeltaText({ children, tone }: { children: React.ReactNode; tone: "down" | "neutral" | "up" }) {
  return (
    <span
      className={cn(
        "font-mono text-sm tnum",
        tone === "up" && "text-success-text",
        tone === "down" && "text-warning-text",
        tone === "neutral" && "text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

function buildWeightSeries(entries: BodyMetricEntry[], unit: WeightUnit, localeCode: string): WeightPoint[] {
  return entries
    .filter((entry): entry is BodyMetricEntry & { weightKg: number } => typeof entry.weightKg === "number")
    .slice()
    .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
    .map((entry) => ({
      label: entry.recordedAt.toLocaleDateString(localeCode, { day: "numeric", month: "short" }),
      value: Number(convertWeightFromKg(entry.weightKg, unit).toFixed(1)),
    }))
}

export function ProgressOverview() {
  const { profile } = useAuth()
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.overview
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  const unit: WeightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  const analyticsQuery = useProgressAnalytics()
  const volumeQuery = useVolumeRecovery()
  const weightQuery = useWeightEntries(WEIGHT_RANGE_DAYS)
  // Seven days so the sleep figure covers the same week as the other tiles.
  const recoveryQuery = useRecoveryHistory(7)

  const entries = useMemo(
    () => [...(weightQuery.data ?? [])].sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime()),
    [weightQuery.data],
  )
  const series = useMemo(() => buildWeightSeries(entries, unit, localeCode), [entries, localeCode, unit])

  const latestWeight = entries.find((entry) => typeof entry.weightKg === "number")
  const oldestWeight = [...entries].reverse().find((entry) => typeof entry.weightKg === "number")
  const weightDeltaKg = latestWeight?.weightKg != null && oldestWeight?.weightKg != null && latestWeight.id !== oldestWeight.id
    ? latestWeight.weightKg - oldestWeight.weightKg
    : null

  const latestComposition = entries.find((entry) => typeof entry.bodyFatPct === "number")
  const previousComposition = entries.filter((entry) => typeof entry.bodyFatPct === "number")[1]
  const bodyFatDelta = latestComposition?.bodyFatPct != null && previousComposition?.bodyFatPct != null
    ? latestComposition.bodyFatPct - previousComposition.bodyFatPct
    : null
  const leanMassKg = calculateLeanMassKg(latestComposition?.weightKg, latestComposition?.bodyFatPct)
  const previousLeanMassKg = calculateLeanMassKg(previousComposition?.weightKg, previousComposition?.bodyFatPct)
  const leanMassDeltaKg = leanMassKg != null && previousLeanMassKg != null ? leanMassKg - previousLeanMassKg : null

  if (analyticsQuery.isPending || volumeQuery.isPending || weightQuery.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    )
  }

  const summary = volumeQuery.data?.summary
  const averageSleepMinutes = recoveryQuery.data?.averages.sleepMinutes ?? null
  const weeklyVolume = analyticsQuery.data?.weeklyVolume ?? []
  const totalWeeklyVolume = weeklyVolume.reduce((sum, point) => sum + point.volume, 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-lg sm:p-5 sm:shadow-none">
        <CardTitle>{copy.thisWeek}</CardTitle>
        <div className="mt-4 grid grid-cols-4 divide-x divide-border lg:grid-cols-5">
          {/* The volume week and the workout count have to come from the same
              window, so both read the volume-recovery response rather than the
              monthly totals in the analytics summary. */}
          <StatTile
            icon={Dumbbell}
            label={copy.workouts}
            value={String(volumeQuery.data?.confidence.workoutSessions ?? 0)}
          />
          <StatTile icon={Flame} label={copy.hardSets} value={String(summary?.hardSets ?? 0)} />
          <StatTile icon={Activity} label={copy.avgRir} value={summary?.averageRir == null ? "—" : String(summary.averageRir)} />
          <StatTile
            icon={Moon}
            label={messages.volumeRecovery.avgSleep}
            value={averageSleepMinutes == null ? "—" : `${Math.floor(averageSleepMinutes / 60)}h ${averageSleepMinutes % 60}m`}
          />
          <StatTile
            icon={TrendingUp}
            label={copy.volume}
            value={`${Math.round(totalWeeklyVolume).toLocaleString(localeCode)} ${unit}`}
            className="hidden lg:block"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-lg sm:p-5 sm:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>{copy.weight}</CardTitle>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tnum text-foreground">
              {formatWeight(latestWeight?.weightKg, unit)}
            </span>
            <span className="text-sm text-muted-foreground">{unit}</span>
            {weightDeltaKg != null ? (
              <DeltaText tone={weightDeltaKg === 0 ? "neutral" : weightDeltaKg < 0 ? "up" : "down"}>
                {formatSignedWeight(weightDeltaKg, unit)} {unit}
              </DeltaText>
            ) : null}
          </span>
        </div>

        {series.length < 2 ? (
          <p className="mt-4 text-sm text-muted-foreground">{copy.needMoreWeightEntries}</p>
        ) : (
          <div className="mt-4 h-44 w-full sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  formatter={(value: number) => [`${value} ${unit}`, copy.weight]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:rounded-lg sm:p-5 sm:shadow-none">
        <CardTitle>{copy.bodyComposition}</CardTitle>
        {latestComposition ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:divide-x sm:divide-border">
            <div className="min-w-0 rounded-xl bg-surface-subtle p-3 sm:rounded-none sm:bg-transparent sm:p-0">
              <p className="font-mono text-2xl font-semibold tnum text-foreground">
                {latestComposition.bodyFatPct?.toFixed(1)}%
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                {copy.bodyFat}
                {bodyFatDelta != null ? (
                  <DeltaText tone={bodyFatDelta === 0 ? "neutral" : bodyFatDelta < 0 ? "up" : "down"}>
                    {bodyFatDelta > 0 ? "+" : ""}{bodyFatDelta.toFixed(1)}%
                  </DeltaText>
                ) : null}
              </p>
            </div>
            <div className="min-w-0 rounded-xl bg-surface-subtle p-3 sm:rounded-none sm:bg-transparent sm:p-0 sm:pl-4">
              <p className="font-mono text-2xl font-semibold tnum text-foreground">
                {formatWeight(leanMassKg, unit)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                {copy.leanMass}
                {leanMassDeltaKg != null ? (
                  <DeltaText tone={leanMassDeltaKg === 0 ? "neutral" : leanMassDeltaKg > 0 ? "up" : "down"}>
                    {formatSignedWeight(leanMassDeltaKg, unit)} {unit}
                  </DeltaText>
                ) : null}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Scale className="size-4" aria-hidden="true" />
            {copy.needBodyFatEntry}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:hidden">
        <CardTitle action={messages.progressPage.viewAll}>{copy.volume}</CardTitle>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <TrendingUp className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-2xl font-semibold tnum text-foreground">
                  {Math.round(totalWeeklyVolume).toLocaleString(localeCode)} {unit}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{copy.volume}</p>
              </div>
            </div>
          </div>
          <MiniBars values={weeklyVolume.slice(-7).map((point) => point.volume)} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:hidden">
        <CardTitle action={messages.progressPage.viewAll}>{messages.progressPage.thisWeek}</CardTitle>
        <div className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4">
          <div className="relative size-24 text-primary">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={(2 * Math.PI * 40) * (1 - Math.min((volumeQuery.data?.confidence.workoutSessions ?? 0) / 6, 1))}
                strokeLinecap="round"
                strokeWidth="10"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold tnum text-foreground">
              {Math.round(Math.min((volumeQuery.data?.confidence.workoutSessions ?? 0) / 6, 1) * 100)}%
            </span>
          </div>
          <div className="min-w-0 border-l border-border pl-4">
            <p className="font-mono text-2xl font-semibold tnum text-foreground">
              {volumeQuery.data?.confidence.workoutSessions ?? 0}/6
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.workouts}</p>
            <p className="mt-2 text-xs text-muted-foreground">{messages.progressPage.analytics.description}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
