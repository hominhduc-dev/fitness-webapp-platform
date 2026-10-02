"use client"

import Link from "next/link"
import type React from "react"
import { useMemo, useState } from "react"
import { ChevronRight, Scale, Share2, Sparkles } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ConsistencyCard } from "@/components/progress/overview/consistency-card"
import { KpiTile } from "@/components/progress/overview/kpi-tile"
import { MuscleZoneCard } from "@/components/progress/overview/muscle-zone-card"
import { PrTimeline } from "@/components/progress/overview/pr-timeline"
import { StrengthList } from "@/components/progress/overview/strength-list"
import { WeekRings } from "@/components/progress/overview/week-rings"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { ShareStatsDialog } from "@/components/share/share-stats-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildConsistencyGrid,
  buildInsightFacts,
  buildStrengthCards,
  rollingAverage,
  seriesChangePct,
} from "@/lib/fitness/progress-overview"
import { PROGRESS_OVERVIEW_RECOVERY_DAYS, PROGRESS_OVERVIEW_WEIGHT_DAYS } from "@/lib/fitness/progress-ranges"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { calculateLeanMassKg, convertWeightFromKg, formatSignedWeight, formatWeight, type WeightUnit } from "@/lib/fitness/weight"
import { buildWeightTrend } from "@/lib/fitness/weight-trend"
import { buildProgressShareCard } from "@/lib/share/stats-card"
import {
  useDashboardAnalytics,
  useProgressYearView,
  useRecoveryHistory,
  useVolumeRecovery,
  useWeightEntries,
} from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const RECENT_RECORDS = 5
const CONSISTENCY_WEEKS = 12
const SLEEP_TARGET_MINUTES = 420

type WeightPoint = { average: number; label: string; value: number }

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
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5",
        // Cards rise in one after another on first paint; nothing moves under reduced motion.
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none",
        className,
      )}
      data-tour={tour}
    >
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
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

/** One reading per day (the day's last), with its trailing seven-day mean. */
function buildWeightSeries(entries: BodyMetricEntry[], unit: WeightUnit, localeCode: string): WeightPoint[] {
  const byDay = new Map<string, BodyMetricEntry & { weightKg: number }>()
  for (const entry of entries) {
    if (typeof entry.weightKg !== "number") continue
    const key = entry.recordedAt.toDateString()
    const existing = byDay.get(key)
    if (!existing || entry.recordedAt > existing.recordedAt) byDay.set(key, entry as BodyMetricEntry & { weightKg: number })
  }
  const daily = Array.from(byDay.values())
    .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
    .map((entry) => ({ date: entry.recordedAt, value: Number(convertWeightFromKg(entry.weightKg, unit).toFixed(1)) }))
  return rollingAverage(daily).map((point) => ({
    average: point.average,
    label: point.date.toLocaleDateString(localeCode, { day: "numeric", month: "short" }),
    value: point.value,
  }))
}

export function ProgressOverview({ analyticsRange }: { analyticsRange: { end: Date; start: Date } }) {
  const { profile } = useAuth()
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.overview
  const periodCopy = messages.progressPage.analytics
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  const unit: WeightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"
  const number = useMemo(() => new Intl.NumberFormat(localeCode, { maximumFractionDigits: 0 }), [localeCode])

  const volumeQuery = useVolumeRecovery()
  const weightQuery = useWeightEntries(PROGRESS_OVERVIEW_WEIGHT_DAYS)
  // Seven days so the sleep figure covers the same week as the other tiles.
  const recoveryQuery = useRecoveryHistory(PROGRESS_OVERVIEW_RECOVERY_DAYS)
  const periodQuery = useDashboardAnalytics(analyticsRange.start, analyticsRange.end)

  // The consistency grid reaches back twelve weeks, which can cross into last year.
  const today = useMemo(() => new Date(), [])
  const gridStart = new Date(today.getTime() - CONSISTENCY_WEEKS * 7 * 24 * 60 * 60 * 1000)
  const thisYearQuery = useProgressYearView(today.getFullYear())
  const lastYearQuery = useProgressYearView(today.getFullYear() - 1, { enabled: gridStart.getFullYear() < today.getFullYear() })
  const consistency = useMemo(
    () => buildConsistencyGrid([...(lastYearQuery.data?.days ?? []), ...(thisYearQuery.data?.days ?? [])], today, CONSISTENCY_WEEKS),
    [lastYearQuery.data, thisYearQuery.data, today],
  )

  const entries = useMemo(
    () => [...(weightQuery.data ?? [])].sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime()),
    [weightQuery.data],
  )
  const series = useMemo(() => buildWeightSeries(entries, unit, localeCode), [entries, localeCode, unit])
  const weightTrend = useMemo(() => buildWeightTrend(entries), [entries])

  const latestWeight = entries.find((entry) => typeof entry.weightKg === "number")
  const latestComposition = entries.find((entry) => typeof entry.bodyFatPct === "number")
  const previousComposition = entries.filter((entry) => typeof entry.bodyFatPct === "number")[1]
  const bodyFatDelta = latestComposition?.bodyFatPct != null && previousComposition?.bodyFatPct != null
    ? latestComposition.bodyFatPct - previousComposition.bodyFatPct
    : null
  const leanMassKg = calculateLeanMassKg(latestComposition?.weightKg, latestComposition?.bodyFatPct)
  const previousLeanMassKg = calculateLeanMassKg(previousComposition?.weightKg, previousComposition?.bodyFatPct)
  const leanMassDeltaKg = leanMassKg != null && previousLeanMassKg != null ? leanMassKg - previousLeanMassKg : null
  const targetWeightKg = profile?.targetWeightKg ?? null
  const remainingToGoalKg = targetWeightKg != null && latestWeight?.weightKg != null
    ? Math.abs(latestWeight.weightKg - targetWeightKg)
    : null

  const period = periodQuery.data
  const volume = volumeQuery.data
  const averageSleepMinutes = recoveryQuery.data?.averages.sleepMinutes ?? null
  const sessionsThisWeek = volume?.confidence.workoutSessions ?? 0
  // The period's last week is the current one; its planned count is the program's weekly plan.
  const plannedThisWeek = period?.workoutFrequency.at(-1)?.planned ?? 0
  const trainedMuscles = (volume?.muscles ?? []).filter((muscle) => muscle.effectiveSets > 0)
  const musclesInRange = trainedMuscles.filter((muscle) => muscle.zone === "mav").length

  const strengthCards = useMemo(
    () => (period ? buildStrengthCards(period.strengthProgress, period.recentPRs.map((pr) => pr.exerciseName)) : []),
    [period],
  )
  const insight = useMemo(
    () => buildInsightFacts({
      muscles: volume?.muscles ?? [],
      plannedThisWeek,
      sessionsThisWeek,
      strength: strengthCards,
      weightRatePerWeekKg: weightTrend.ratePerWeekKg,
    }),
    [plannedThisWeek, sessionsThisWeek, strengthCards, volume?.muscles, weightTrend.ratePerWeekKg],
  )
  const insightParts = [
    copy.insight.sessions(insight.sessionsThisWeek, insight.plannedThisWeek),
    insight.strongestLift ? copy.insight.strongest(insight.strongestLift.name, insight.strongestLift.changePct) : null,
    trainedMuscles.length > 0 ? (insight.musclesToAdjust > 0 ? copy.insight.adjust(insight.musclesToAdjust) : copy.insight.onTrack) : null,
    insight.weightRatePerWeekKg != null
      ? copy.insight.weightRate(formatSignedWeight(insight.weightRatePerWeekKg, unit) ?? "", unit)
      : null,
  ].filter((part): part is string => Boolean(part))

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

  const sessionsSeries = period?.workoutFrequency.map((point) => point.completed) ?? []
  const volumeSeries = period?.trainingVolume.map((point) => point.volume) ?? []
  const strengthSeries = strengthCards[0]?.values ?? []

  return (
    <div className="space-y-4 md:space-y-6">
      {/* One line that reads the numbers below for the trainee. */}
      {insightParts.length > 0 && !volumeQuery.isPending ? (
        <p
          className="flex items-start gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm leading-6 text-foreground animate-in fade-in duration-500 motion-reduce:animate-none"
          data-tour="progress-insight"
        >
          <Sparkles className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{insightParts.join(" · ")}</span>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card title={copy.thisWeek} tour="progress-this-week">
          {volumeQuery.isPending ? (
            <Skeleton className="h-36 rounded-xl" />
          ) : (
            <WeekRings
              readiness={volume?.readiness.score ?? null}
              rings={[
                {
                  color: "var(--chart-1)",
                  key: "sessions",
                  label: copy.rings.sessions,
                  progress: plannedThisWeek > 0 ? sessionsThisWeek / plannedThisWeek : sessionsThisWeek > 0 ? 1 : 0,
                  value: plannedThisWeek > 0 ? copy.rings.detail(String(sessionsThisWeek), String(plannedThisWeek)) : String(sessionsThisWeek),
                },
                {
                  color: "var(--chart-2)",
                  key: "muscles",
                  label: copy.rings.muscles,
                  progress: trainedMuscles.length > 0 ? musclesInRange / trainedMuscles.length : 0,
                  value: copy.rings.detail(String(musclesInRange), String(trainedMuscles.length)),
                },
                {
                  color: "var(--chart-4)",
                  key: "sleep",
                  label: copy.rings.sleep,
                  progress: averageSleepMinutes == null ? 0 : averageSleepMinutes / SLEEP_TARGET_MINUTES,
                  value: averageSleepMinutes == null ? "—" : `${Math.floor(averageSleepMinutes / 60)}h ${averageSleepMinutes % 60}m`,
                },
              ]}
            />
          )}
        </Card>

        <Card
          title={copy.body}
          tour="progress-body"
          className="[animation-delay:80ms]"
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="text-3xl font-semibold leading-none text-foreground">
                  {formatWeight(weightTrend.sevenDayAverageKg ?? latestWeight?.weightKg, unit)}
                </span>
                <span className="text-sm text-muted-foreground">{unit}</span>
                {weightTrend.ratePerWeekKg != null ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold tnum text-foreground">
                    {copy.bodyTrend.perWeek(formatSignedWeight(weightTrend.ratePerWeekKg, unit) ?? "", unit)}
                  </span>
                ) : null}
                {remainingToGoalKg != null ? (
                  <span className="text-xs text-muted-foreground">{copy.bodyTrend.toGoal(formatWeight(remainingToGoalKg, unit), unit)}</span>
                ) : null}
              </div>

              {series.length < 2 ? (
                <p className="mt-3 text-sm text-muted-foreground">{copy.needMoreWeightEntries}</p>
              ) : (
                <>
                  <div className="mt-3 h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ bottom: 0, left: -20, right: 8, top: 8 }}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                        <Tooltip
                          cursor={{ stroke: "var(--border)" }}
                          formatter={(value: number, name: string) => [`${value} ${unit}`, name === "average" ? copy.bodyTrend.trend : copy.bodyTrend.daily]}
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                        />
                        {/* Daily readings as faint points; the seven-day mean is the line to read. */}
                        <Line type="monotone" dataKey="value" stroke="transparent" dot={{ fill: "var(--muted-foreground)", fillOpacity: 0.45, r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="average" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-primary" aria-hidden="true" />{copy.bodyTrend.trend}</span>
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden="true" />{copy.bodyTrend.daily}</span>
                  </div>
                </>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                {latestComposition ? (
                  <>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{copy.bodyFat}</p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg font-semibold text-foreground">{latestComposition.bodyFatPct?.toFixed(1)}%</span>
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
                        <span className="text-lg font-semibold text-foreground">
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
        ) : period ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" data-tour="progress-period-summary">
              <KpiTile
                label={copy.kpi.sessions}
                value={period.summary.sessionsPerWeek}
                format={(value) => value.toFixed(1)}
                changePct={seriesChangePct(sessionsSeries)}
                changeLabel={copy.kpi.trend}
                series={sessionsSeries}
              />
              <KpiTile
                label={copy.kpi.volume}
                value={period.summary.totalVolume}
                format={(value) => number.format(value)}
                unit="kg"
                changePct={Math.round(period.summary.volumeDeltaPct)}
                changeLabel={periodCopy.comparison}
                series={volumeSeries}
              />
              <KpiTile
                label={copy.kpi.strength}
                value={period.summary.e1rmChangePct}
                format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`}
                detail={`${period.summary.e1rmChangeTotalKg > 0 ? "+" : ""}${period.summary.e1rmChangeTotalKg} kg e1RM`}
                series={strengthSeries}
              />
              <KpiTile
                label={copy.kpi.records}
                value={period.summary.newPRsCount}
                format={(value) => number.format(value)}
                detail={period.summary.latestPR ? copy.kpi.lastPR(period.summary.latestPR.exerciseName) : periodCopy.noRecords}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <Card title={copy.zones.title} tour="progress-muscles" action={<span className="hidden text-xs text-muted-foreground sm:inline">{copy.zones.hint}</span>}>
                {volumeQuery.isPending ? <Skeleton className="h-56 rounded-xl" /> : <MuscleZoneCard muscles={volume?.muscles ?? []} />}
              </Card>
              <Card title={copy.consistency.title} tour="progress-consistency" className="[animation-delay:80ms]">
                {thisYearQuery.isPending ? <Skeleton className="h-40 rounded-xl" /> : <ConsistencyCard {...consistency} />}
              </Card>
              <Card title={copy.strength.title} tour="progress-strength">
                <StrengthList cards={strengthCards} unit="kg" />
              </Card>
              <Card title={periodCopy.recent} tour="progress-records" className="[animation-delay:80ms]">
                <PrTimeline prs={period.recentPRs.slice(0, RECENT_RECORDS)} />
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
