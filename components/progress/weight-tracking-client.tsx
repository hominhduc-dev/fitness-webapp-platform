"use client"

import type React from "react"
import { startTransition, useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { createWeightEntry, fetchWeightEntries } from "@/lib/fitness/api"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Constants & pure utilities (unchanged from original)
// ---------------------------------------------------------------------------

const KG_TO_LBS = 2.20462
const RANGE_OPTIONS = [30, 90, 365] as const

type RangeValue = (typeof RANGE_OPTIONS)[number]
type GoalDirection = "down" | "steady" | "up"
type DeltaTone = "danger" | "neutral" | "success"
type TrendDirection = "down" | "stable" | "up"
type BmiCategory = "healthy" | "obese" | "overweight" | "underweight"
type ChartPoint = {
  label: string
  value: number | null
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function isFiniteNumber(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function convertWeightFromKg(weightKg: number, unit: "kg" | "lbs") {
  return unit === "lbs" ? weightKg * KG_TO_LBS : weightKg
}

function convertWeightToKg(weight: number, unit: "kg" | "lbs") {
  return unit === "lbs" ? weight / KG_TO_LBS : weight
}

function formatWeight(weightKg: number | null | undefined, unit: "kg" | "lbs", fractionDigits = 1) {
  if (!isFiniteNumber(weightKg)) return "--"
  return convertWeightFromKg(weightKg, unit).toFixed(fractionDigits)
}

function formatSignedWeight(weightKg: number | null | undefined, unit: "kg" | "lbs", fractionDigits = 1) {
  if (!isFiniteNumber(weightKg)) return null
  const converted = convertWeightFromKg(weightKg, unit)
  const prefix = converted > 0 ? "+" : ""
  return `${prefix}${converted.toFixed(fractionDigits)}`
}

function calculateBmi(weightKg?: number, heightCm?: number) {
  if (!isFiniteNumber(weightKg) || !isFiniteNumber(heightCm) || heightCm <= 0) return undefined
  const heightMeters = heightCm / 100
  return weightKg / (heightMeters * heightMeters)
}

function getBmiCategory(bmi?: number): BmiCategory | null {
  if (!isFiniteNumber(bmi)) return null
  if (bmi < 18.5) return "underweight"
  if (bmi < 25) return "healthy"
  if (bmi < 30) return "overweight"
  return "obese"
}

function getGoalDirection(currentWeightKg?: number, targetWeightKg?: number): GoalDirection {
  if (!isFiniteNumber(currentWeightKg) || !isFiniteNumber(targetWeightKg)) return "steady"
  const delta = currentWeightKg - targetWeightKg
  if (Math.abs(delta) <= 0.15) return "steady"
  return delta > 0 ? "down" : "up"
}

function getDeltaTone(deltaKg: number | undefined, direction: GoalDirection): DeltaTone {
  if (!isFiniteNumber(deltaKg)) return "neutral"
  if (direction === "down") return deltaKg <= 0 ? "success" : "danger"
  if (direction === "up") return deltaKg >= 0 ? "success" : "danger"
  return Math.abs(deltaKg) <= 0.2 ? "success" : "neutral"
}

function getTrendDirection(currentWeightKg?: number, weeklyAverageKg?: number): TrendDirection {
  if (!isFiniteNumber(currentWeightKg) || !isFiniteNumber(weeklyAverageKg)) return "stable"
  const delta = currentWeightKg - weeklyAverageKg
  if (Math.abs(delta) <= 0.15) return "stable"
  return delta > 0 ? "up" : "down"
}

function getWeeklyTargetKg(direction: GoalDirection) {
  if (direction === "down") return 0.4
  if (direction === "up") return 0.25
  return 0.2
}

function getDayKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

function collapseEntriesByDay(entries: BodyMetricEntry[]) {
  const byDay = new Map<string, BodyMetricEntry>()
  entries
    .slice()
    .sort((l, r) => l.recordedAt.getTime() - r.recordedAt.getTime())
    .forEach((entry) => {
      if (!isFiniteNumber(entry.weightKg)) return
      byDay.set(getDayKey(entry.recordedAt), entry)
    })
  return Array.from(byDay.values()).sort((l, r) => l.recordedAt.getTime() - r.recordedAt.getTime())
}

function buildChartPoints(entries: BodyMetricEntry[], days: RangeValue, unit: "kg" | "lbs", localeCode: string): ChartPoint[] {
  const bucketCount = days === 365 ? 12 : 10
  const today = startOfDay(new Date())
  const start = startOfDay(new Date(today))
  start.setDate(today.getDate() - (days - 1))

  const dailyEntries = collapseEntriesByDay(entries)
  const shortFmt = new Intl.DateTimeFormat(
    localeCode,
    days === 365 ? { month: "short" } : { month: "short", day: "numeric" },
  )

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startOfDay(new Date(start))
    bucketStart.setDate(start.getDate() + Math.floor((index * days) / bucketCount))

    const bucketEnd = startOfDay(new Date(start))
    bucketEnd.setDate(start.getDate() + Math.floor(((index + 1) * days) / bucketCount) - 1)

    const entry = dailyEntries
      .filter((item) => {
        const d = startOfDay(item.recordedAt)
        return d >= bucketStart && d <= bucketEnd
      })
      .at(-1)

    const value =
      isFiniteNumber(entry?.weightKg)
        ? Number(convertWeightFromKg(entry.weightKg!, unit).toFixed(1))
        : null

    return {
      label: shortFmt.format(bucketStart).toUpperCase(),
      value,
    }
  })
}

function buildWeightSummary(entries: BodyMetricEntry[], targetWeightKg?: number | null) {
  const weightedEntries = entries.filter((e) => isFiniteNumber(e.weightKg))
  const currentWeightKg = weightedEntries[0]?.weightKg
  const previousWeightKg = weightedEntries[1]?.weightKg
  const currentDeltaKg =
    isFiniteNumber(currentWeightKg) && isFiniteNumber(previousWeightKg)
      ? currentWeightKg - previousWeightKg
      : undefined

  const weeklyEntries = entries.filter((e) => Date.now() - e.recordedAt.getTime() <= 7 * 86400000)
  const weeklyAverageKg =
    weeklyEntries.length > 0
      ? weeklyEntries.reduce((t, e) => t + (e.weightKg ?? 0), 0) / weeklyEntries.length
      : undefined

  const oldestWeeklyWeightKg = weeklyEntries.at(-1)?.weightKg
  const weeklyChangeKg =
    isFiniteNumber(currentWeightKg) && isFiniteNumber(oldestWeeklyWeightKg)
      ? currentWeightKg - oldestWeeklyWeightKg
      : currentDeltaKg

  const oldestLoggedWeightKg = weightedEntries.at(-1)?.weightKg
  const hasTargetWeight = isFiniteNumber(targetWeightKg)
  const resolvedCurrentWeightKg = isFiniteNumber(currentWeightKg) ? currentWeightKg : undefined
  const canTrackGoal = hasTargetWeight && resolvedCurrentWeightKg != null
  const goalDirection = getGoalDirection(resolvedCurrentWeightKg, targetWeightKg ?? undefined)
  const goalStartWeightKg =
    canTrackGoal && isFiniteNumber(oldestLoggedWeightKg) ? oldestLoggedWeightKg : resolvedCurrentWeightKg
  const targetDeltaKg = canTrackGoal ? resolvedCurrentWeightKg - (targetWeightKg as number) : undefined
  const isTargetMet = isFiniteNumber(targetDeltaKg) ? Math.abs(targetDeltaKg) <= 0.15 : false
  const totalGoalDirection =
    canTrackGoal && isFiniteNumber(goalStartWeightKg)
      ? getGoalDirection(goalStartWeightKg, targetWeightKg ?? undefined)
      : ("steady" satisfies GoalDirection)
  const totalGoalDistanceKg =
    canTrackGoal && isFiniteNumber(goalStartWeightKg)
      ? Math.abs(goalStartWeightKg - (targetWeightKg as number))
      : undefined
  const weeklyTargetKg =
    canTrackGoal && !isTargetMet
      ? Math.min(getWeeklyTargetKg(goalDirection), Math.abs(targetDeltaKg as number))
      : 0

  let goalProgressPct = 0
  let goalRemainingKg: number | undefined
  let weeklyGoalProgressPct = 0
  let weeklyGoalRemainingKg: number | undefined

  if (canTrackGoal) {
    if (isTargetMet) {
      goalProgressPct = 100
      goalRemainingKg = 0
    } else if (!isFiniteNumber(totalGoalDistanceKg) || totalGoalDistanceKg <= 0.15) {
      goalProgressPct = 0
      goalRemainingKg = Math.abs(targetDeltaKg as number)
    } else if (totalGoalDirection === "down") {
      const remaining = Math.max(resolvedCurrentWeightKg - (targetWeightKg as number), 0)
      goalProgressPct = Math.max(0, Math.min(100, Math.round(((totalGoalDistanceKg - remaining) / totalGoalDistanceKg) * 100)))
      goalRemainingKg = remaining
    } else if (totalGoalDirection === "up") {
      const remaining = Math.max((targetWeightKg as number) - resolvedCurrentWeightKg, 0)
      goalProgressPct = Math.max(0, Math.min(100, Math.round(((totalGoalDistanceKg - remaining) / totalGoalDistanceKg) * 100)))
      goalRemainingKg = remaining
    } else {
      goalProgressPct = 0
      goalRemainingKg = Math.abs(targetDeltaKg as number)
    }

    if (weeklyTargetKg <= 0) {
      weeklyGoalProgressPct = 100
      weeklyGoalRemainingKg = 0
    } else if (goalDirection === "down") {
      const prog = isFiniteNumber(weeklyChangeKg) ? Math.max(-weeklyChangeKg, 0) : 0
      weeklyGoalProgressPct = Math.min(100, Math.round((prog / weeklyTargetKg) * 100))
      weeklyGoalRemainingKg = Math.max(0, weeklyTargetKg - prog)
    } else if (goalDirection === "up") {
      const prog = isFiniteNumber(weeklyChangeKg) ? Math.max(weeklyChangeKg, 0) : 0
      weeklyGoalProgressPct = Math.min(100, Math.round((prog / weeklyTargetKg) * 100))
      weeklyGoalRemainingKg = Math.max(0, weeklyTargetKg - prog)
    }
  }

  return {
    canTrackGoal,
    currentDeltaKg,
    currentWeightKg,
    goalDirection,
    goalProgressPct,
    goalRemainingKg,
    goalStartWeightKg,
    hasTargetWeight,
    isTargetMet,
    targetDeltaKg,
    targetWeightKg: hasTargetWeight ? targetWeightKg : undefined,
    weeklyAverageKg,
    weeklyChangeKg,
    weeklyGoalProgressPct,
    weeklyGoalRemainingKg,
    weeklyTargetKg,
  }
}

function downloadCsv(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildCsv(entries: BodyMetricEntry[], unit: "kg" | "lbs") {
  const header = ["recorded_at", "weight", "unit", "note"]
  const rows = entries.map((entry) => [
    entry.recordedAt.toISOString(),
    formatWeight(entry.weightKg, unit, 1),
    unit,
    `"${(entry.note ?? "").replace(/"/g, '""')}"`,
  ])
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function WeightTrackingSkeleton() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-16 w-48 rounded" />
      </div>
      <div className="mb-6">
        <Skeleton className="h-[280px] w-full rounded-[10px]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({
  footer,
  label,
  unit,
  value,
}: {
  footer?: React.ReactNode
  label: string
  unit?: string
  value: string
}) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <span className="label-micro block">{label}</span>
      <div className="mt-2 flex items-end gap-1.5">
        <span className="font-mono text-[2rem] font-semibold leading-none tnum text-foreground">{value}</span>
        {unit ? <span className="mb-0.5 text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {footer ? <div className="mt-2 min-h-5 text-sm">{footer}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip (no shadow, Lift style)
// ---------------------------------------------------------------------------

type LiftTooltipProps = {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<any>
  label?: string
  unit?: string
  [key: string]: unknown
}

function LiftTooltip({ active, payload, label, unit = "kg" }: LiftTooltipProps) {
  if (!active || !payload?.length || payload[0].value == null) return null
  return (
    <div className="rounded-[6px] border border-border bg-card px-3 py-2 shadow-none">
      <p className="label-micro mb-1">{label}</p>
      <p className="font-mono text-sm font-medium tnum text-foreground">
        {payload[0].value} <span className="text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function WeightTrackingClient() {
  const { isLoading: authLoading, profile, session } = useAuth()
  const { locale, messages } = useLocale()
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  const weightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"
  const heightCm = profile?.heightCm ?? undefined
  const targetWeightKg = profile?.targetWeightKg ?? undefined

  const [entries, setEntries] = useState<BodyMetricEntry[]>([])
  const [selectedRange, setSelectedRange] = useState<RangeValue>(30)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadEntries() {
      if (authLoading) return
      if (!session?.access_token) {
        startTransition(() => {
          setEntries([])
          setIsLoadingPage(false)
        })
        return
      }

      setIsLoadingPage(true)
      setError(null)

      try {
        const nextEntries = await fetchWeightEntries(session.access_token, selectedRange)
        if (cancelled) return
        startTransition(() => {
          setEntries(nextEntries.sort((l, r) => r.recordedAt.getTime() - l.recordedAt.getTime()))
          setShowAllHistory(false)
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : messages.progressPage.loadFailed)
      } finally {
        if (!cancelled) setIsLoadingPage(false)
      }
    }

    void loadEntries()
    return () => { cancelled = true }
  }, [authLoading, messages.progressPage.loadFailed, selectedRange, session?.access_token])

  const summary = useMemo(() => buildWeightSummary(entries, targetWeightKg), [entries, targetWeightKg])
  const chartPoints = useMemo(
    () => buildChartPoints(entries, selectedRange, weightUnit, localeCode),
    [entries, selectedRange, weightUnit, localeCode],
  )

  const currentDeltaTone = getDeltaTone(summary.currentDeltaKg, summary.goalDirection)
  const weeklyTrendDirection = getTrendDirection(summary.currentWeightKg, summary.weeklyAverageKg)
  const bmi = useMemo(() => calculateBmi(summary.currentWeightKg, heightCm), [heightCm, summary.currentWeightKg])
  const bmiCategory = getBmiCategory(bmi)
  const historyEntries = showAllHistory ? entries : entries.slice(0, 5)

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(localeCode, { day: "2-digit", month: "short" }),
    [localeCode],
  )
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(localeCode, { hour: "2-digit", minute: "2-digit" }),
    [localeCode],
  )

  async function handleSaveEntry() {
    if (!session?.access_token) return
    const parsedValue = Number(inputValue)
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setError(messages.progressPage.genericSaveError)
      return
    }

    setIsSaving(true)
    setError(null)
    setInfoMessage(null)

    try {
      const bodyMetric = await createWeightEntry(session.access_token, {
        recordedAt: new Date().toISOString(),
        weightKg: Number(convertWeightToKg(parsedValue, weightUnit).toFixed(2)),
      })
      startTransition(() => {
        setEntries((curr) =>
          [bodyMetric, ...curr]
            .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
            .sort((l, r) => r.recordedAt.getTime() - l.recordedAt.getTime()),
        )
        setInputValue("")
      })
      setInfoMessage(messages.progressPage.saveSuccess)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.progressPage.genericSaveError)
    } finally {
      setIsSaving(false)
    }
  }

  function handleExportCsv() {
    if (entries.length === 0) {
      setInfoMessage(messages.progressPage.exportEmpty)
      return
    }
    downloadCsv(buildCsv(entries, weightUnit), `weight-tracking-${selectedRange}d.csv`)
    setInfoMessage(null)
  }

  if (authLoading || isLoadingPage) return <WeightTrackingSkeleton />

  const currentWeightDisplay = formatWeight(summary.currentWeightKg, weightUnit)

  // Absolute change from oldest to current in range
  const rangeChangeKg =
    entries.length >= 2 && isFiniteNumber(entries[0]?.weightKg) && isFiniteNumber(entries.at(-1)?.weightKg)
      ? entries[0].weightKg! - entries.at(-1)!.weightKg!
      : undefined

  const rangeChangeDisplay = formatSignedWeight(rangeChangeKg, weightUnit)
  const rangeChangeTone = getDeltaTone(rangeChangeKg, summary.goalDirection)

  // Only show chart points that have data (or all, Recharts handles nulls)
  const hasChartData = chartPoints.some((p) => p.value !== null)

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
      <div className="flex flex-col gap-8">

        {/* ---- Header ---- */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="label-micro mb-2 block">Body</span>
            <h1 className="text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
              Body weight
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              className="h-9 rounded-full border-border bg-card px-4 text-sm font-medium shadow-none hover:bg-muted"
            >
              {messages.progressPage.exportCsv}
            </Button>
          </div>
        </section>

        {/* ---- Feedback messages ---- */}
        {(error || infoMessage) && (
          <div
            className={cn(
              "rounded-[8px] border px-4 py-3 text-sm",
              error
                ? "border-destructive/20 bg-destructive/5 text-destructive"
                : "border-primary/15 bg-primary/5 text-primary",
            )}
          >
            {error ?? infoMessage}
          </div>
        )}

        {/* ---- Weight hero + chart card ---- */}
        <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6">
          {/* Hero row */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="label-micro mb-1 block">Body weight</span>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[4rem] font-semibold leading-none tnum text-foreground">
                  {currentWeightDisplay}
                </span>
                <span className="text-base text-muted-foreground">{weightUnit}</span>
                {rangeChangeDisplay ? (
                  <span
                    className={cn(
                      "font-mono text-sm tnum",
                      rangeChangeTone === "success" && "text-[var(--success)]",
                      rangeChangeTone === "danger" && "text-destructive",
                      rangeChangeTone === "neutral" && "text-muted-foreground",
                    )}
                  >
                    {Number(rangeChangeKg ?? 0) < 0 ? "↓" : "↑"} {Math.abs(Number(rangeChangeKg ?? 0)).toFixed(1)} {weightUnit}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Range chips */}
            <div className="flex gap-1.5">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRange(r)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-xs tnum transition-colors",
                    selectedRange === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {r === 30 ? messages.progressPage.days30
                    : r === 90 ? messages.progressPage.days90
                    : messages.progressPage.year1}
                </button>
              ))}
            </div>
          </div>

          {/* Line chart */}
          {!hasChartData ? (
            <div className="flex min-h-[14rem] items-center justify-center rounded-[8px] border border-dashed border-border text-sm text-muted-foreground">
              {messages.progressPage.emptyTrend}
            </div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartPoints} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid
                    strokeDasharray="0"
                    stroke="var(--border)"
                    strokeWidth={1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    content={(props) => <LiftTooltip {...props} unit={weightUnit} />}
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-1)"
                    strokeWidth={1.75}
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ---- Log weight input ---- */}
        <section className="rounded-[10px] border border-border bg-card p-4 sm:p-5">
          <span className="label-micro mb-4 block">Log weight</span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                aria-label={messages.progressPage.logTitle}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                inputMode="decimal"
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                className="h-14 rounded-[8px] border-input bg-background pr-14 text-center font-mono text-2xl font-semibold tnum shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-primary"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                {weightUnit}
              </span>
            </div>
            <Button
              type="button"
              onClick={() => void handleSaveEntry()}
              disabled={isSaving}
              className="h-14 min-w-[9rem] gap-2 rounded-[8px] font-medium shadow-none"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {isSaving ? messages.progressPage.savingEntry : "Log weight"}
            </Button>
          </div>
        </section>

        {/* ---- Summary metric cards ---- */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* Current weight */}
          <MetricCard
            label={messages.progressPage.currentWeight}
            value={formatWeight(summary.currentWeightKg, weightUnit)}
            unit={weightUnit}
            footer={
              summary.currentDeltaKg == null ? (
                <span className="text-muted-foreground">{messages.progressPage.unavailable}</span>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-xs tnum font-medium",
                    currentDeltaTone === "success" && "text-[var(--success)]",
                    currentDeltaTone === "danger" && "text-destructive",
                    currentDeltaTone === "neutral" && "text-muted-foreground",
                  )}
                >
                  {currentDeltaTone === "success" ? (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : currentDeltaTone === "danger" ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {formatSignedWeight(summary.currentDeltaKg, weightUnit)}
                  <span>{weightUnit}</span>
                </span>
              )
            }
          />

          {/* Weekly average */}
          <MetricCard
            label={messages.progressPage.weeklyAverage}
            value={formatWeight(summary.weeklyAverageKg, weightUnit)}
            unit={weightUnit}
            footer={
              <span className="font-mono text-xs tnum text-muted-foreground">
                {weeklyTrendDirection === "stable"
                  ? messages.progressPage.stable
                  : weeklyTrendDirection === "up"
                    ? messages.progressPage.trendingUp
                    : messages.progressPage.trendingDown}
              </span>
            }
          />

          {/* Goal progress */}
          <MetricCard
            label={messages.progressPage.goalProgress}
            value={summary.hasTargetWeight ? String(summary.goalProgressPct) : "--"}
            unit={summary.hasTargetWeight ? "%" : undefined}
            footer={
              summary.hasTargetWeight ? (
                <div className="space-y-2">
                  <span className="font-mono text-xs tnum text-muted-foreground">
                    {messages.progressPage.goalTarget(
                      formatWeight(summary.targetWeightKg, weightUnit),
                      weightUnit,
                    )}
                  </span>
                  <Progress
                    value={summary.goalProgressPct}
                    className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-primary"
                  />
                </div>
              ) : (
                <span className="label-micro text-muted-foreground">{messages.progressPage.targetWeightNeeded}</span>
              )
            }
          />

          {/* BMI */}
          <MetricCard
            label={messages.progressPage.bodyMassIndex}
            value={bmi != null ? bmi.toFixed(1) : "--"}
            footer={
              bmi != null && bmiCategory ? (
                <div className="space-y-1.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase",
                      bmiCategory === "healthy" && "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
                      bmiCategory === "underweight" && "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]",
                      bmiCategory === "overweight" && "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]",
                      bmiCategory === "obese" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {bmiCategory === "healthy"
                      ? messages.progressPage.bmiHealthy
                      : bmiCategory === "underweight"
                        ? messages.progressPage.bmiUnderweight
                        : bmiCategory === "overweight"
                          ? messages.progressPage.bmiOverweight
                          : messages.progressPage.bmiObese}
                  </span>
                  <p className="font-mono text-xs tnum text-muted-foreground">
                    {messages.progressPage.bmiBasedOnHeight(String(Math.round(heightCm ?? 0)))}
                  </p>
                </div>
              ) : (
                <span className="label-micro text-muted-foreground">{messages.progressPage.bmiNeedsHeight}</span>
              )
            }
          />
        </section>

        {/* ---- History + weekly goal row ---- */}
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">

          {/* Recent entries list */}
          <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="label-micro">{messages.progressPage.history}</span>
              {entries.length > 5 ? (
                <button
                  type="button"
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="label-micro text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAllHistory ? messages.progressPage.showLess : messages.progressPage.viewAll}
                </button>
              ) : null}
            </div>

            {historyEntries.length === 0 ? (
              <div className="flex min-h-[8rem] items-center justify-center rounded-[8px] border border-dashed border-border text-sm text-muted-foreground">
                {messages.progressPage.emptyHistory}
              </div>
            ) : (
              <div>
                {historyEntries.map((entry) => {
                  const olderEntry = entries[entries.findIndex((x) => x.id === entry.id) + 1]
                  const deltaKg =
                    isFiniteNumber(entry.weightKg) && isFiniteNumber(olderEntry?.weightKg)
                      ? entry.weightKg - olderEntry.weightKg
                      : undefined
                  const deltaTone = getDeltaTone(deltaKg, summary.goalDirection)
                  const deltaDisplay = formatSignedWeight(deltaKg, weightUnit)

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between border-b border-border py-3.5 last:border-b-0"
                    >
                      <div>
                        <p className="font-mono text-sm font-medium tnum text-foreground">
                          {dateFormatter.format(entry.recordedAt)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] tnum text-muted-foreground">
                          {timeFormatter.format(entry.recordedAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-base font-semibold tnum text-foreground">
                          {formatWeight(entry.weightKg, weightUnit)}{" "}
                          <span className="text-sm font-normal text-muted-foreground">{weightUnit}</span>
                        </p>
                        {deltaDisplay ? (
                          <p
                            className={cn(
                              "mt-0.5 font-mono text-xs tnum font-medium",
                              deltaTone === "success" && "text-[var(--success)]",
                              deltaTone === "danger" && "text-destructive",
                              deltaTone === "neutral" && "text-muted-foreground",
                            )}
                          >
                            {deltaDisplay} {weightUnit}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Weekly goal card */}
          <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6">
            <span className="label-micro mb-4 block">{messages.progressPage.weeklyGoal}</span>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {!summary.hasTargetWeight
                ? messages.progressPage.targetWeightNeeded
                : !summary.canTrackGoal
                  ? messages.progressPage.emptyTrend
                  : summary.isTargetMet
                    ? messages.progressPage.targetWeightReached(
                        formatWeight(summary.targetWeightKg, weightUnit),
                        weightUnit,
                      )
                    : (summary.weeklyGoalRemainingKg ?? 0) <= 0
                      ? messages.progressPage.goalAchieved
                      : messages.progressPage.goalAway(
                          formatWeight(summary.weeklyGoalRemainingKg, weightUnit),
                          weightUnit,
                        )}
            </p>

            {summary.hasTargetWeight ? (
              <p className="mt-2 font-mono text-xs tnum text-muted-foreground">
                {messages.progressPage.goalTarget(
                  formatWeight(summary.targetWeightKg, weightUnit),
                  weightUnit,
                )}
              </p>
            ) : null}

            <Progress
              value={summary.hasTargetWeight ? summary.weeklyGoalProgressPct : 0}
              className="mt-6 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-primary"
            />

            {summary.hasTargetWeight && (
              <div className="mt-2 flex justify-between font-mono text-[10px] tnum text-muted-foreground">
                <span>0%</span>
                <span>{summary.weeklyGoalProgressPct}%</span>
              </div>
            )}
          </section>
        </div>

      </div>
    </div>
  )
}
