"use client"

import type React from "react"
import { startTransition, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { createWeightEntry, fetchWeightEntries } from "@/lib/fitness/api"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

const KG_TO_LBS = 2.20462
const RANGE_OPTIONS = [30, 90, 365] as const

type RangeValue = (typeof RANGE_OPTIONS)[number]
type GoalDirection = "down" | "steady" | "up"
type DeltaTone = "danger" | "neutral" | "success"
type TrendDirection = "down" | "stable" | "up"
type BmiCategory = "healthy" | "obese" | "overweight" | "underweight"
type ChartBar = {
  entry?: BodyMetricEntry
  heightPct: number
  id: string
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
  if (!isFiniteNumber(weightKg)) {
    return "--"
  }

  return convertWeightFromKg(weightKg, unit).toFixed(fractionDigits)
}

function formatSignedWeight(weightKg: number | null | undefined, unit: "kg" | "lbs", fractionDigits = 1) {
  if (!isFiniteNumber(weightKg)) {
    return null
  }

  const converted = convertWeightFromKg(weightKg, unit)
  const prefix = converted > 0 ? "+" : ""
  return `${prefix}${converted.toFixed(fractionDigits)}`
}

function calculateBmi(weightKg?: number, heightCm?: number) {
  if (!isFiniteNumber(weightKg) || !isFiniteNumber(heightCm) || heightCm <= 0) {
    return undefined
  }

  const heightMeters = heightCm / 100
  return weightKg / (heightMeters * heightMeters)
}

function getBmiCategory(bmi?: number): BmiCategory | null {
  if (!isFiniteNumber(bmi)) {
    return null
  }

  if (bmi < 18.5) {
    return "underweight"
  }

  if (bmi < 25) {
    return "healthy"
  }

  if (bmi < 30) {
    return "overweight"
  }

  return "obese"
}

function getGoalDirection(currentWeightKg?: number, targetWeightKg?: number): GoalDirection {
  if (!isFiniteNumber(currentWeightKg) || !isFiniteNumber(targetWeightKg)) {
    return "steady" satisfies GoalDirection
  }

  const deltaToTargetKg = currentWeightKg - targetWeightKg

  if (Math.abs(deltaToTargetKg) <= 0.15) {
    return "steady" satisfies GoalDirection
  }

  return deltaToTargetKg > 0 ? ("down" satisfies GoalDirection) : ("up" satisfies GoalDirection)
}

function getDeltaTone(deltaKg: number | undefined, direction: GoalDirection): DeltaTone {
  if (!isFiniteNumber(deltaKg)) {
    return "neutral"
  }

  if (direction === "down") {
    return deltaKg <= 0 ? "success" : "danger"
  }

  if (direction === "up") {
    return deltaKg >= 0 ? "success" : "danger"
  }

  return Math.abs(deltaKg) <= 0.2 ? "success" : "neutral"
}

function getTrendDirection(currentWeightKg?: number, weeklyAverageKg?: number): TrendDirection {
  if (!isFiniteNumber(currentWeightKg) || !isFiniteNumber(weeklyAverageKg)) {
    return "stable"
  }

  const delta = currentWeightKg - weeklyAverageKg

  if (Math.abs(delta) <= 0.15) {
    return "stable"
  }

  return delta > 0 ? "up" : "down"
}

function getWeeklyTargetKg(direction: GoalDirection) {
  if (direction === "down") {
    return 0.4
  }

  if (direction === "up") {
    return 0.25
  }

  return 0.2
}

function getDayKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10)
}

function collapseEntriesByDay(entries: BodyMetricEntry[]) {
  const byDay = new Map<string, BodyMetricEntry>()

  entries
    .slice()
    .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
    .forEach((entry) => {
      if (!isFiniteNumber(entry.weightKg)) {
        return
      }

      byDay.set(getDayKey(entry.recordedAt), entry)
    })

  return Array.from(byDay.values()).sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
}

function buildChartBars(entries: BodyMetricEntry[], days: RangeValue): ChartBar[] {
  const bucketCount = days === 365 ? 12 : 10
  const today = startOfDay(new Date())
  const start = startOfDay(new Date(today))
  start.setDate(today.getDate() - (days - 1))

  const dailyEntries = collapseEntriesByDay(entries)
  const buckets = Array.from({ length: bucketCount }, (_value, index) => {
    const bucketStart = startOfDay(new Date(start))
    bucketStart.setDate(start.getDate() + Math.floor((index * days) / bucketCount))

    const bucketEnd = startOfDay(new Date(start))
    bucketEnd.setDate(start.getDate() + Math.floor(((index + 1) * days) / bucketCount) - 1)

    const entry = dailyEntries
      .filter((item) => {
        const entryDate = startOfDay(item.recordedAt)
        return entryDate >= bucketStart && entryDate <= bucketEnd
      })
      .at(-1)

    return {
      entry,
      id: `${bucketStart.toISOString()}-${index}`,
    }
  })

  const weights = buckets.flatMap((bucket) => (isFiniteNumber(bucket.entry?.weightKg) ? [bucket.entry.weightKg] : []))
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0

  return buckets.map((bucket) => {
    if (!isFiniteNumber(bucket.entry?.weightKg)) {
      return {
        ...bucket,
        heightPct: 28,
      }
    }

    if (Math.abs(maxWeight - minWeight) < 0.05) {
      return {
        ...bucket,
        heightPct: 78,
      }
    }

    return {
      ...bucket,
      heightPct: 34 + ((bucket.entry.weightKg - minWeight) / (maxWeight - minWeight)) * 48,
    }
  })
}

function buildAxisLabels(days: RangeValue, localeCode: string) {
  const today = startOfDay(new Date())
  const start = startOfDay(new Date(today))
  start.setDate(today.getDate() - (days - 1))

  const middle = startOfDay(new Date(start))
  middle.setDate(start.getDate() + Math.floor(days / 2))

  const formatter = new Intl.DateTimeFormat(
    localeCode,
    days === 365 ? { month: "short", year: "2-digit" } : { month: "short", day: "2-digit" },
  )

  return [start, middle, today].map((value) => formatter.format(value).toUpperCase())
}

function buildWeightSummary(entries: BodyMetricEntry[], targetWeightKg?: number | null) {
  const currentWeightKg = entries[0]?.weightKg
  const previousWeightKg = entries[1]?.weightKg
  const currentDeltaKg =
    isFiniteNumber(currentWeightKg) && isFiniteNumber(previousWeightKg) ? currentWeightKg - previousWeightKg : undefined

  const weeklyEntries = entries.filter((entry) => {
    const differenceMs = Date.now() - entry.recordedAt.getTime()
    return differenceMs <= 7 * 24 * 60 * 60 * 1000
  })

  const weeklyAverageKg =
    weeklyEntries.length > 0
      ? weeklyEntries.reduce((total, entry) => total + (entry.weightKg ?? 0), 0) / weeklyEntries.length
      : undefined

  const oldestWeeklyWeightKg = weeklyEntries.at(-1)?.weightKg
  const weeklyChangeKg =
    isFiniteNumber(currentWeightKg) && isFiniteNumber(oldestWeeklyWeightKg)
      ? currentWeightKg - oldestWeeklyWeightKg
      : currentDeltaKg

  const hasTargetWeight = isFiniteNumber(targetWeightKg)
  const resolvedCurrentWeightKg = isFiniteNumber(currentWeightKg) ? currentWeightKg : undefined
  const canTrackGoal = hasTargetWeight && resolvedCurrentWeightKg != null
  const goalDirection = getGoalDirection(resolvedCurrentWeightKg, targetWeightKg ?? undefined)
  const targetDeltaKg = canTrackGoal ? resolvedCurrentWeightKg - (targetWeightKg as number) : undefined
  const isTargetMet = isFiniteNumber(targetDeltaKg) ? Math.abs(targetDeltaKg) <= 0.15 : false
  const weeklyTargetKg =
    canTrackGoal && !isTargetMet
      ? Math.min(getWeeklyTargetKg(goalDirection), Math.abs(targetDeltaKg as number))
      : 0

  let goalProgressPct = 0
  let goalRemainingKg: number | undefined

  if (canTrackGoal) {
    if (weeklyTargetKg <= 0) {
      goalProgressPct = 100
      goalRemainingKg = 0
    } else if (goalDirection === "down") {
      const progressWeightKg = isFiniteNumber(weeklyChangeKg) ? Math.max(-weeklyChangeKg, 0) : 0
      goalProgressPct = Math.min(100, Math.round((progressWeightKg / weeklyTargetKg) * 100))
      goalRemainingKg = Math.max(0, weeklyTargetKg - progressWeightKg)
    } else if (goalDirection === "up") {
      const progressWeightKg = isFiniteNumber(weeklyChangeKg) ? Math.max(weeklyChangeKg, 0) : 0
      goalProgressPct = Math.min(100, Math.round((progressWeightKg / weeklyTargetKg) * 100))
      goalRemainingKg = Math.max(0, weeklyTargetKg - progressWeightKg)
    }
  }

  return {
    canTrackGoal,
    currentDeltaKg,
    currentWeightKg,
    goalDirection,
    goalProgressPct,
    goalRemainingKg,
    hasTargetWeight,
    isTargetMet,
    targetDeltaKg,
    targetWeightKg: hasTargetWeight ? targetWeightKg : undefined,
    weeklyAverageKg,
    weeklyChangeKg,
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

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

function WeightTrackingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-12 w-72 rounded-2xl" />
            <Skeleton className="h-5 w-80 max-w-full rounded-xl" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-12 w-36 rounded-full" />
            <Skeleton className="h-12 w-40 rounded-full" />
          </div>
        </div>

        <div className="rounded-[32px] border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-end">
            <Skeleton className="h-20 w-full rounded-[28px] lg:max-w-[420px]" />
            <Skeleton className="h-20 w-full rounded-[24px] lg:w-44" />
          </div>
        </div>

        <div className="grid gap-4 rounded-[32px] border border-border/70 bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_value, index) => (
            <div key={index} className="space-y-3 rounded-[24px] border border-border/50 bg-white/70 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="rounded-[32px] border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-10 w-52 rounded-full" />
            </div>
            <div className="mt-8 grid h-72 grid-cols-10 items-end gap-4">
              {Array.from({ length: 10 }, (_value, index) => (
                <Skeleton
                  key={index}
                  className="w-full rounded-full"
                  style={{ height: `${index % 2 === 0 ? 72 : 84}%` }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="mt-6 space-y-4">
                {Array.from({ length: 3 }, (_value, index) => (
                  <div key={index} className="flex items-center justify-between rounded-[22px] border border-border/60 p-4">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-2 text-right">
                      <Skeleton className="ml-auto h-6 w-20" />
                      <Skeleton className="ml-auto h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-border/70 bg-card p-5 shadow-sm">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="mt-4 h-20 w-full" />
              <Skeleton className="mt-6 h-3 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WeightTrackingClient() {
  const { isLoading: authLoading, profile, session } = useAuth()
  const { locale, messages } = useLocale()
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  const weightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"
  const heightCm = profile?.heightCm ?? undefined
  const targetWeightKg = profile?.targetWeightKg ?? undefined

  const [entries, setEntries] = useState<BodyMetricEntry[]>([])
  const [selectedRange, setSelectedRange] = useState<RangeValue>(30)
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadEntries() {
      if (authLoading) {
        return
      }

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

        if (cancelled) {
          return
        }

        startTransition(() => {
          setEntries(nextEntries.sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime()))
          setShowAllHistory(false)
        })
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setError(nextError instanceof Error ? nextError.message : messages.progressPage.loadFailed)
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false)
        }
      }
    }

    void loadEntries()

    return () => {
      cancelled = true
    }
  }, [authLoading, messages.progressPage.loadFailed, selectedRange, session?.access_token])

  const summary = useMemo(() => buildWeightSummary(entries, targetWeightKg), [entries, targetWeightKg])
  const chartBars = useMemo(() => buildChartBars(entries, selectedRange), [entries, selectedRange])
  const axisLabels = useMemo(() => buildAxisLabels(selectedRange, localeCode), [localeCode, selectedRange])

  useEffect(() => {
    const fallbackBarId = chartBars.filter((bar) => bar.entry).at(-1)?.id ?? chartBars.at(-1)?.id ?? null
    setSelectedBarId((current) => (current && chartBars.some((bar) => bar.id === current) ? current : fallbackBarId))
  }, [chartBars])

  const selectedBar = chartBars.find((bar) => bar.id === selectedBarId) ?? chartBars.at(-1)
  const selectedWeightKg = selectedBar?.entry?.weightKg
  const selectedDate = selectedBar?.entry?.recordedAt
  const currentDeltaTone = getDeltaTone(summary.currentDeltaKg, summary.goalDirection)
  const weeklyTrendDirection = getTrendDirection(summary.currentWeightKg, summary.weeklyAverageKg)
  const bmi = useMemo(() => calculateBmi(summary.currentWeightKg, heightCm), [heightCm, summary.currentWeightKg])
  const bmiCategory = getBmiCategory(bmi)
  const historyEntries = showAllHistory ? entries : entries.slice(0, 3)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        day: "2-digit",
        month: "short",
      }),
    [localeCode],
  )
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [localeCode],
  )

  async function handleSaveEntry() {
    if (!session?.access_token) {
      return
    }

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
        setEntries((current) =>
          [bodyMetric, ...current]
            .filter((entry, index, list) => list.findIndex((item) => item.id === entry.id) === index)
            .sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime()),
        )
        setInputValue("")
      })

      setInfoMessage(messages.progressPage.saveSuccess)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : messages.progressPage.genericSaveError)
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

  function handleConnectScale() {
    setInfoMessage(messages.progressPage.connectScaleNote)
  }

  if (authLoading || isLoadingPage) {
    return <WeightTrackingSkeleton />
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{messages.progressPage.title}</h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">{messages.progressPage.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              className="h-10 rounded-full border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-none hover:bg-slate-50"
            >
              {messages.progressPage.exportCsv}
            </Button>
            <Button
              type="button"
              onClick={handleConnectScale}
              variant="outline"
              className="h-10 rounded-full border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-none hover:bg-slate-50"
            >
              {messages.progressPage.connectScale}
            </Button>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
            <div className="relative w-full lg:max-w-[420px]">
              <Input
                aria-label={messages.progressPage.logTitle}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                inputMode="decimal"
                type="number"
                step="0.1"
                min="0"
                placeholder={messages.progressPage.entryPlaceholder}
                className="h-18 rounded-[20px] border-slate-200 bg-slate-50 px-6 pr-22 text-center text-4xl font-black tracking-[-0.05em] text-slate-700 shadow-none placeholder:text-slate-300 sm:h-20 sm:text-5xl"
              />
              <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-xl font-semibold text-slate-400">
                {weightUnit}
              </span>
            </div>

            <Button
              type="button"
              onClick={() => void handleSaveEntry()}
              disabled={isSaving}
              className="h-18 rounded-[20px] px-7 text-lg font-semibold shadow-none sm:h-20 sm:min-w-40 sm:text-xl"
            >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
              {isSaving ? messages.progressPage.savingEntry : messages.progressPage.saveEntry}
            </Button>
          </div>
        </section>

        {(error || infoMessage) && (
          <div
            className={cn(
              "rounded-[18px] border px-4 py-3 text-sm",
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-primary/15 bg-primary/5 text-primary",
            )}
          >
            {error ?? infoMessage}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label={messages.progressPage.currentWeight}
            value={formatWeight(summary.currentWeightKg, weightUnit)}
            unit={weightUnit}
            footer={
              summary.currentDeltaKg == null ? (
                <span className="text-slate-400">{messages.progressPage.unavailable}</span>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-semibold",
                    currentDeltaTone === "success" && "text-emerald-500",
                    currentDeltaTone === "danger" && "text-rose-500",
                    currentDeltaTone === "neutral" && "text-slate-500",
                  )}
                >
                  {currentDeltaTone === "success" ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : currentDeltaTone === "danger" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  {formatSignedWeight(summary.currentDeltaKg, weightUnit)}
                  <span>{weightUnit}</span>
                </span>
              )
            }
          />

          <SummaryCard
            label={messages.progressPage.weeklyAverage}
            value={formatWeight(summary.weeklyAverageKg, weightUnit)}
            unit={weightUnit}
            footer={
              <span className="text-slate-400">
                {weeklyTrendDirection === "stable"
                  ? messages.progressPage.stable
                  : weeklyTrendDirection === "up"
                    ? messages.progressPage.trendingUp
                    : messages.progressPage.trendingDown}
              </span>
            }
          />

          <SummaryCard
            label={messages.progressPage.goalProgress}
            value={summary.hasTargetWeight ? String(summary.goalProgressPct) : "--"}
            unit={summary.hasTargetWeight ? "%" : undefined}
            footer={
              summary.hasTargetWeight ? (
                <div className="space-y-2 pt-1">
                  <span className="text-slate-400">
                    {messages.progressPage.goalTarget(
                      formatWeight(summary.targetWeightKg, weightUnit),
                      weightUnit,
                    )}
                  </span>
                  <Progress
                    value={summary.goalProgressPct}
                    className="h-2.5 bg-slate-100 [&_[data-slot=progress-indicator]]:bg-primary"
                  />
                </div>
                ) : (
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-[0.18em] text-slate-500">
                      {messages.progressPage.profileNeeded}
                    </span>
                    <p className="text-sm text-slate-400">{messages.progressPage.targetWeightNeeded}</p>
                  </div>
                )
              }
            />

          <SummaryCard
            label={messages.progressPage.bodyMassIndex}
            value={bmi != null ? bmi.toFixed(1) : "--"}
            footer={
              bmi != null && bmiCategory ? (
                <div className="space-y-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-[0.18em]",
                      bmiCategory === "healthy" && "bg-emerald-50 text-emerald-600",
                      bmiCategory === "underweight" && "bg-amber-50 text-amber-600",
                      bmiCategory === "overweight" && "bg-orange-50 text-orange-600",
                      bmiCategory === "obese" && "bg-rose-50 text-rose-600",
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
                  <p className="text-sm text-slate-400">{messages.progressPage.bmiBasedOnHeight(String(Math.round(heightCm ?? 0)))}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-[0.18em] text-slate-500">
                    {messages.progressPage.profileNeeded}
                  </span>
                  <p className="text-sm text-slate-400">{messages.progressPage.bmiNeedsHeight}</p>
                </div>
              )
            }
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">{messages.progressPage.trendTitle}</h2>
              </div>

              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                {RANGE_OPTIONS.map((rangeOption) => (
                  <button
                    key={rangeOption}
                    type="button"
                    onClick={() => setSelectedRange(rangeOption)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      selectedRange === rangeOption ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600",
                    )}
                  >
                    {rangeOption === 30
                      ? messages.progressPage.days30
                      : rangeOption === 90
                        ? messages.progressPage.days90
                        : messages.progressPage.year1}
                  </button>
                ))}
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="mt-10 flex min-h-[22rem] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-6 text-center text-slate-400">
                {messages.progressPage.emptyTrend}
              </div>
            ) : (
              <div className="mt-8">
                <div className="mb-5 h-8 text-center text-slate-900">
                  {selectedWeightKg != null ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">
                      {formatWeight(selectedWeightKg, weightUnit)} {weightUnit}
                    </span>
                  ) : null}
                </div>

                <div className="grid min-h-[18rem] grid-cols-10 items-end gap-3 sm:gap-4">
                  {chartBars.map((bar) => {
                    const isActive = bar.id === selectedBarId

                    return (
                      <button
                        key={bar.id}
                        type="button"
                        onClick={() => setSelectedBarId(bar.id)}
                        className="group flex h-full items-end justify-center"
                      >
                        <span
                          className={cn(
                            "w-full max-w-4 rounded-full transition-all duration-200 sm:max-w-3",
                            isActive
                              ? "bg-slate-900"
                              : bar.entry
                                ? "bg-slate-200 group-hover:bg-slate-300"
                                : "bg-slate-100/70",
                          )}
                          style={{ height: `${bar.heightPct}%` }}
                        />
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-bold tracking-[0.24em] text-slate-400">
                  {axisLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                {selectedDate ? (
                  <p className="mt-4 text-center text-sm text-slate-400">
                    {messages.progressPage.latestEntry}: {dateFormatter.format(selectedDate)}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-950">{messages.progressPage.history}</h2>
                {entries.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory((current) => !current)}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    {showAllHistory ? messages.progressPage.showLess : messages.progressPage.viewAll}
                  </button>
                ) : null}
              </div>

              {historyEntries.length === 0 ? (
                <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-slate-400">
                  {messages.progressPage.emptyHistory}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {historyEntries.map((entry) => {
                    const olderEntry = entries[entries.findIndex((item) => item.id === entry.id) + 1]
                    const deltaKg =
                      isFiniteNumber(entry.weightKg) && isFiniteNumber(olderEntry?.weightKg)
                        ? entry.weightKg - olderEntry.weightKg
                        : undefined
                    const deltaTone = getDeltaTone(deltaKg, summary.goalDirection)

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between border-b border-slate-100 py-4 last:border-b-0"
                      >
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-slate-900">
                            {dateFormatter.format(entry.recordedAt)}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">{timeFormatter.format(entry.recordedAt)}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-semibold tracking-tight text-slate-950">
                            {formatWeight(entry.weightKg, weightUnit)} <span className="text-sm text-slate-400">{weightUnit}</span>
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-sm font-semibold",
                              deltaTone === "success" && "text-emerald-500",
                              deltaTone === "danger" && "text-rose-500",
                              deltaTone === "neutral" && "text-slate-400",
                            )}
                          >
                            {formatSignedWeight(deltaKg, weightUnit) ?? " "}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
              <div className="text-xl font-bold tracking-tight text-slate-950">{messages.progressPage.weeklyGoal}</div>

                <p className="mt-4 text-base leading-7 text-slate-500">
                  {!summary.hasTargetWeight
                    ? messages.progressPage.targetWeightNeeded
                    : !summary.canTrackGoal
                      ? messages.progressPage.emptyTrend
                      : summary.isTargetMet
                        ? messages.progressPage.targetWeightReached(
                            formatWeight(summary.targetWeightKg, weightUnit),
                            weightUnit,
                          )
                        : (summary.goalRemainingKg ?? 0) <= 0
                          ? messages.progressPage.goalAchieved
                          : messages.progressPage.goalAway(
                              formatWeight(summary.goalRemainingKg, weightUnit),
                              weightUnit,
                            )}
                </p>

                {summary.hasTargetWeight ? (
                  <p className="mt-3 text-sm text-slate-400">
                    {messages.progressPage.goalTarget(formatWeight(summary.targetWeightKg, weightUnit), weightUnit)}
                  </p>
                ) : null}

                <Progress
                  value={summary.hasTargetWeight ? summary.goalProgressPct : 0}
                  className="mt-8 h-2.5 bg-slate-100 [&_[data-slot=progress-indicator]]:bg-primary"
                />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  footer,
  label,
  unit,
  value,
}: {
  footer: React.ReactNode
  label: string
  unit?: string
  value: string
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
        {unit ? <span className="pb-1 text-lg font-medium text-slate-400">{unit}</span> : null}
      </div>
      <div className="mt-3 min-h-8 text-sm">{footer}</div>
    </div>
  )
}
