"use client"

import type React from "react"
import { useMemo } from "react"
import { Activity, Dumbbell, Flame, Scale, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { calculateLeanMassKg, convertWeightFromKg, formatSignedWeight, formatWeight, type WeightUnit } from "@/lib/fitness/weight"
import { useProgressAnalytics, useVolumeRecovery, useWeightEntries } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const WEIGHT_RANGE_DAYS = 90

type WeightPoint = { label: string; value: number }

function StatTile({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <Icon className="mx-auto size-4 text-primary" aria-hidden="true" />
      <p className="mt-2 truncate font-mono text-lg font-semibold tnum text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-micro text-muted-foreground">{label}</p>
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
  const weeklyVolume = analyticsQuery.data?.weeklyVolume ?? []
  const totalWeeklyVolume = weeklyVolume.reduce((sum, point) => sum + point.volume, 0)

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{copy.thisWeek}</h2>
        <div className="mt-4 grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
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
            icon={TrendingUp}
            label={copy.volume}
            value={`${Math.round(totalWeeklyVolume).toLocaleString(localeCode)} ${unit}`}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{copy.weight}</h2>
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
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ bottom: 0, left: -16, right: 8, top: 8 }}>
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

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{copy.bodyComposition}</h2>
        {latestComposition ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
            <div className="min-w-0">
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
            <div className="min-w-0 sm:pl-4">
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
    </div>
  )
}
