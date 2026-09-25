"use client"

import Link from "next/link"
import type React from "react"
import { useMemo, useState } from "react"
import { ChevronRight, Dumbbell, Flame, Moon, Scale, Share2, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { MuscleDistributionChart } from "@/components/progress/dashboard/muscle-distribution-chart"
import { PrFeed } from "@/components/progress/dashboard/pr-feed"
import { SummaryCards } from "@/components/progress/dashboard/summary-cards"
import { TrainingVolumeChart } from "@/components/progress/dashboard/training-volume-chart"
import { WorkoutFrequencyChart } from "@/components/progress/dashboard/workout-frequency-chart"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { ShareStatsDialog } from "@/components/share/share-stats-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PROGRESS_OVERVIEW_RECOVERY_DAYS, PROGRESS_OVERVIEW_WEIGHT_DAYS } from "@/lib/fitness/progress-ranges"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { calculateLeanMassKg, convertWeightFromKg, formatSignedWeight, formatWeight, type WeightUnit } from "@/lib/fitness/weight"
import { buildProgressShareCard } from "@/lib/share/stats-card"
import {
  useDashboardAnalytics,
  useProgressAnalytics,
  useRecoveryHistory,
  useVolumeRecovery,
  useWeightEntries,
} from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const RECENT_RECORDS = 5

type WeightPoint = { label: string; value: number }

function Card({
  action,
  children,
  className,
  title,
  tour,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  title: string
  /** The product tour's anchor for this card. */
  tour?: string
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5", className)} data-tour={tour}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function MetricTile({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-subtle p-3">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <p className="mt-2 truncate font-mono text-lg font-semibold leading-tight tnum text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
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

export function ProgressOverview({ analyticsRange }: { analyticsRange: { end: Date; start: Date } }) {
  const { profile } = useAuth()
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.overview
  const periodCopy = messages.progressPage.analytics
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  const unit: WeightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  const analyticsQuery = useProgressAnalytics()
  const volumeQuery = useVolumeRecovery()
  const weightQuery = useWeightEntries(PROGRESS_OVERVIEW_WEIGHT_DAYS)
  // Seven days so the sleep figure covers the same week as the other tiles.
  const recoveryQuery = useRecoveryHistory(PROGRESS_OVERVIEW_RECOVERY_DAYS)
  const periodQuery = useDashboardAnalytics(analyticsRange.start, analyticsRange.end)

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

  const summary = volumeQuery.data?.summary
  const averageSleepMinutes = recoveryQuery.data?.averages.sleepMinutes ?? null
  const totalWeeklyVolume = (analyticsQuery.data?.weeklyVolume ?? []).reduce((sum, point) => sum + point.volume, 0)
  const period = periodQuery.data

  const [shareOpen, setShareOpen] = useState(false)
  const shareCopy = messages.progressPage.share
  // Built eagerly from the period the page already loaded, so opening the sheet
  // costs no request and the card always matches what is on screen.
  const shareCard = useMemo(
    () =>
      period
        ? buildProgressShareCard({
            athleteName: profile?.name,
            copy: {
              anonymousAthlete: shareCopy.anonymousAthlete,
              avgDuration: messages.progressPage.avgDuration,
              headlineCaption: shareCopy.headlineCaption,
              newRecords: shareCopy.newRecords,
              strength: shareCopy.strength,
              vsPrevious: periodCopy.comparison,
              workouts: periodCopy.completed,
            },
            localeCode,
            periodLabel: periodCopy.period,
            stamp: analyticsRange.end.toLocaleDateString(localeCode, { day: "numeric", month: "short", year: "numeric" }),
            summary: period.summary,
            weightUnit: unit,
          })
        : null,
    [analyticsRange.end, localeCode, messages.progressPage.avgDuration, period, periodCopy, profile?.name, shareCopy, unit],
  )

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card title={copy.thisWeek} tour="progress-this-week">
          {analyticsQuery.isPending || volumeQuery.isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {/* The workout count and hard sets come from the volume-recovery
                  week so they describe the same window. */}
              <MetricTile icon={Dumbbell} label={copy.workouts} value={String(volumeQuery.data?.confidence.workoutSessions ?? 0)} />
              <MetricTile icon={TrendingUp} label={copy.volume} value={`${Math.round(totalWeeklyVolume).toLocaleString(localeCode)} ${unit}`} />
              <MetricTile icon={Flame} label={copy.hardSets} value={String(summary?.hardSets ?? 0)} />
              <MetricTile
                icon={Moon}
                label={messages.volumeRecovery.avgSleep}
                value={averageSleepMinutes == null ? "—" : `${Math.floor(averageSleepMinutes / 60)}h ${averageSleepMinutes % 60}m`}
              />
            </div>
          )}
        </Card>

        <Card
          title={copy.body}
          tour="progress-body"
          action={
            <Link href="/trackweight" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary hover:underline">
              {copy.logWeight}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          }
        >
          {weightQuery.isPending ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-3xl font-semibold leading-none tnum text-foreground">
                  {formatWeight(latestWeight?.weightKg, unit)}
                </span>
                <span className="text-sm text-muted-foreground">{unit}</span>
                {weightDeltaKg != null ? (
                  <DeltaText tone={weightDeltaKg === 0 ? "neutral" : weightDeltaKg < 0 ? "up" : "down"}>
                    {formatSignedWeight(weightDeltaKg, unit)} {unit}
                  </DeltaText>
                ) : null}
              </div>

              {series.length < 2 ? (
                <p className="mt-3 text-sm text-muted-foreground">{copy.needMoreWeightEntries}</p>
              ) : (
                <div className="mt-3 h-36 w-full sm:h-40">
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
                      <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                {latestComposition ? (
                  <>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{copy.bodyFat}</p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-lg font-semibold tnum text-foreground">{latestComposition.bodyFatPct?.toFixed(1)}%</span>
                        {bodyFatDelta != null ? (
                          <DeltaText tone={bodyFatDelta === 0 ? "neutral" : bodyFatDelta < 0 ? "up" : "down"}>
                            {bodyFatDelta > 0 ? "+" : ""}{bodyFatDelta.toFixed(1)}%
                          </DeltaText>
                        ) : null}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{copy.leanMass}</p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-lg font-semibold tnum text-foreground">
                          {formatWeight(leanMassKg, unit)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
                        </span>
                        {leanMassDeltaKg != null ? (
                          <DeltaText tone={leanMassDeltaKg === 0 ? "neutral" : leanMassDeltaKg > 0 ? "up" : "down"}>
                            {formatSignedWeight(leanMassDeltaKg, unit)} {unit}
                          </DeltaText>
                        ) : null}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Scale className="size-4 shrink-0" aria-hidden="true" />
                    {copy.needBodyFatEntry}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <section aria-labelledby="progress-period" className="space-y-4">
        <div className="flex items-center justify-between gap-3" data-tour="progress-period">
          <h2 id="progress-period" className="text-lg font-semibold tracking-tight text-foreground">{periodCopy.period}</h2>
          {shareCard ? (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted pointer-coarse:min-h-11"
            >
              <Share2 className="size-4" aria-hidden="true" />
              {shareCopy.trigger}
            </button>
          ) : null}
        </div>

        {periodQuery.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-2xl" />
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
        ) : period ? (
          <>
            <div data-tour="progress-period-summary">
              <SummaryCards summary={period.summary} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <Card
                title={periodCopy.frequency}
                tour="progress-frequency"
                action={
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" />{periodCopy.completedLegend}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-border" />{periodCopy.plannedLegend}</span>
                  </div>
                }
              >
                <WorkoutFrequencyChart data={period.workoutFrequency} />
              </Card>
              <Card title={periodCopy.volume} tour="progress-volume" action={<span className="text-xs text-muted-foreground">kg</span>}>
                <TrainingVolumeChart data={period.trainingVolume} />
              </Card>
              <Card title={periodCopy.muscles} tour="progress-muscles">
                <MuscleDistributionChart data={period.muscleGroupDistribution} />
              </Card>
              <Card title={periodCopy.recent} tour="progress-records">
                <PrFeed prs={period.recentPRs.slice(0, RECENT_RECORDS)} />
              </Card>
            </div>
          </>
        ) : (
          <div className="flex min-h-[10rem] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
            {periodCopy.empty}
          </div>
        )}
      </section>

      {shareOpen && shareCard ? (
        <ShareStatsDialog
          data={shareCard}
          fileNamePrefix="yeahbuddy-progress"
          onClose={() => setShareOpen(false)}
          shareText={shareCopy.shareText}
          shareTitle={shareCopy.title}
        />
      ) : null}
    </div>
  )
}
