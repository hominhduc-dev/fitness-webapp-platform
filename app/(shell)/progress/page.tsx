"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts"

import { useAuth } from "@/components/providers/auth-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchProgressAnalytics } from "@/lib/fitness/api"
import type { ProgressAnalytics } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const EMPTY_ANALYTICS: ProgressAnalytics = {
  muscleGroupDistribution: [],
  personalRecords: [],
  strengthProgression: { points: [], series: [] },
  summary: {
    bestStreakDays: 0,
    currentStreakDays: 0,
    totalVolumeThisMonth: 0,
    workoutsThisMonth: 0,
  },
  weeklyVolume: [],
}

type WorkoutKind = "all" | "pull" | "push" | "legs"
type Tab = "history" | "prs"

const KIND_COLORS: Record<string, string> = {
  push: "var(--chart-1)",
  pull: "var(--chart-3)",
  legs: "var(--chart-4)",
}

function kindColor(k: string): string {
  return KIND_COLORS[k] ?? "var(--color-muted-foreground)"
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatShortDate(date: Date, localeCode = "en-US") {
  return new Intl.DateTimeFormat(localeCode, {
    day: "numeric",
    month: "short",
  }).format(date)
}

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date())
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Mono micro-label following Lift label-micro spec */
function LabelMicro({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("label-micro", className)}>{children}</span>
}

/** PRs filter chip */
function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

/** Inline sparkline SVG — matches Lift PRs spec */
function Sparkline({ data, width = 220, height = 56 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 8) - 4
    return [x, y]
  })

  const d = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ")
  const [lx, ly] = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="block w-full"
      preserveAspectRatio="none"
    >
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill="var(--chart-1)" />
    </svg>
  )
}

/** Calendar section */
function CalendarSection({
  filter,
  workoutsThisMonth,
}: {
  filter: WorkoutKind
  workoutsThisMonth: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay() // 0 = Sun

  // Build day cells with offset padding
  const cells: Array<number | null> = Array.from({ length: firstDayOfWeek }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="rounded-[10px] border border-border bg-card p-5">
      {/* Day-of-week headers */}
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <div
            key={d}
            className="label-micro py-1.5 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />

          const isToday = day === today.getDate()
          // We don't have per-day workout data from the analytics API, so we
          // show the total workouts indicator only on today as a demo hint.
          // Real calendar data would need a separate API call.
          const hasWorkout = false // placeholder — real data not available per-day
          const dim = hasWorkout && filter !== "all"

          return (
            <button
              key={day}
              type="button"
              onMouseEnter={() => setHovered(day)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "relative flex aspect-square flex-col items-start justify-between rounded-[6px] border p-1.5 text-left transition-colors",
                isToday
                  ? "border-primary border-[1.5px] text-primary"
                  : "border-border text-foreground hover:bg-muted",
                hovered === day && !isToday && "bg-muted",
                dim && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[11px] leading-none tnum",
                  isToday ? "font-semibold text-primary" : "text-foreground",
                )}
              >
                {day}
              </span>
              {hasWorkout && (
                <span
                  className="self-end rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: kindColor("push"),
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 border-t border-border pt-3.5">
        {(["push", "pull", "legs"] as const).map((k) => (
          <div key={k} className="label-micro inline-flex items-center gap-1.5">
            <span
              className="rounded-full"
              style={{ width: 6, height: 6, background: kindColor(k), display: "inline-block" }}
            />
            {k[0].toUpperCase() + k.slice(1)}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Recent sessions list */
function RecentSessions({
  personalRecords,
  weightUnitLabel,
}: {
  personalRecords: ProgressAnalytics["personalRecords"]
  weightUnitLabel: string
}) {
  if (personalRecords.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted-foreground">
        Log workouts to see recent sessions here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {personalRecords.slice(0, 8).map((record) => {
        const dateLabel = formatShortDate(record.date)
        // Derive kind from weight — placeholder mapping; adapt once API returns kind
        const kind = "push"

        return (
          <div
            key={`${record.exercise}-${record.date.toISOString()}`}
            className="flex cursor-pointer items-center gap-3.5 rounded-[8px] border border-border bg-card p-3 transition-colors hover:bg-muted"
          >
            {/* Date column */}
            <div className="w-9 shrink-0 text-center">
              <div className="label-micro leading-tight">{dateLabel.split(" ")[0]}</div>
              <div className="font-mono text-[17px] font-semibold leading-tight tnum text-foreground">
                {dateLabel.split(" ")[1]}
              </div>
            </div>

            {/* Colored left bar */}
            <div
              className="h-8 w-1 shrink-0 rounded-sm"
              style={{ background: kindColor(kind) }}
            />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {record.exercise}
              </div>
              <div className="mt-0.5 font-mono text-[11px] tnum text-muted-foreground">
                {record.weight} {weightUnitLabel}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        )
      })}
    </div>
  )
}

/** PR card with sparkline */
function PrCard({
  record,
  weightUnitLabel,
}: {
  record: ProgressAnalytics["personalRecords"][number]
  weightUnitLabel: string
}) {
  // Build a minimal sparkline series from just the single PR point — in
  // production this would come from the strength progression series.
  const sparkData = [record.weight * 0.88, record.weight * 0.92, record.weight * 0.95, record.weight * 0.97, record.weight]

  return (
    <div className="flex flex-col gap-3.5 rounded-[10px] border border-border bg-card p-5">
      {/* Exercise name */}
      <div className="flex items-center justify-between">
        <span className="label-micro">{record.exercise}</span>
        <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--accent-foreground)]">
          PR
        </span>
      </div>

      {/* Big value */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[2.5rem] font-semibold leading-none tnum text-foreground">
          {record.weight}
        </span>
        <span className="text-sm text-muted-foreground">{weightUnitLabel}</span>
      </div>

      {/* Delta + date */}
      <div className="flex items-center gap-3 font-mono text-[11px] tnum">
        <span className="text-[var(--success)]">↑ set {formatShortDate(record.date)}</span>
      </div>

      {/* Sparkline */}
      <div className="mt-1">
        <Sparkline data={sparkData} height={48} />
      </div>

      {/* Time axis labels */}
      <div className="label-micro flex justify-between">
        <span>Earlier</span>
        <span>Now</span>
      </div>
    </div>
  )
}

/** Strength progression chart using Recharts LineChart */
function StrengthChart({
  analytics,
  weightUnitLabel,
}: {
  analytics: ProgressAnalytics
  weightUnitLabel: string
}) {
  const { series, points } = analytics.strengthProgression

  const hasData = series.length > 0

  if (!hasData) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted-foreground">
        Complete weighted sets across a few weeks to unlock strength progression.
      </div>
    )
  }

  const chartData = points.map((point) => ({ label: point.label, ...point.values }))

  return (
    <div className="rounded-[10px] border border-border bg-card p-5">
      <LabelMicro className="mb-4 block">Strength progression</LabelMicro>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--border)"
              strokeWidth={1}
              vertical={false}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke="var(--chart-1)"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
                name={s.exerciseName}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {series.map((s) => (
          <div key={s.key} className="label-micro inline-flex items-center gap-1.5">
            <span
              className="rounded-full"
              style={{ width: 6, height: 6, background: "var(--chart-1)", display: "inline-block" }}
            />
            {s.exerciseName}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ProgressPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-9 w-48 rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[26rem] rounded-[10px]" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-[8px]" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const { isLoading: authLoading, profile, session } = useAuth()
  const [analytics, setAnalytics] = useState<ProgressAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("history")
  const [filter, setFilter] = useState<WorkoutKind>("all")

  const weightUnitLabel = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  useEffect(() => {
    if (authLoading) return

    if (!session?.access_token) {
      setAnalytics(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadAnalytics = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const next = await fetchProgressAnalytics(session.access_token)
        if (!cancelled) setAnalytics(next)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load progress analytics.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token])

  const data = analytics ?? EMPTY_ANALYTICS

  const workoutsThisMonth = data.summary.workoutsThisMonth

  const hasPersonalRecords = data.personalRecords.length > 0

  if (authLoading || (isLoading && analytics == null)) {
    return <ProgressPageSkeleton />
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">

      {/* ---- Page header ---- */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <LabelMicro className="mb-2 block">{currentMonthLabel()}</LabelMicro>
          <h1 className="text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
            {workoutsThisMonth} {workoutsThisMonth === 1 ? "workout" : "workouts"}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "push", "pull", "legs"] as WorkoutKind[]).map((k) => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
              {k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}
            </Chip>
          ))}
        </div>
      </div>

      {/* ---- Tab strip ---- */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {(["history", "prs"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "label-micro -mb-px border-b-2 px-4 py-2.5 transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "history" ? "History" : "Personal records"}
          </button>
        ))}
      </div>

      {/* ---- Error banner ---- */}
      {error ? (
        <div className="mb-6 rounded-[8px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* ================================================================
          HISTORY TAB
          ================================================================ */}
      {tab === "history" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          {/* Calendar card */}
          <CalendarSection filter={filter} workoutsThisMonth={workoutsThisMonth} />

          {/* Recent sessions sidebar */}
          <div>
            <LabelMicro className="mb-3 block">Recent</LabelMicro>
            <RecentSessions
              personalRecords={data.personalRecords}
              weightUnitLabel={weightUnitLabel}
            />
          </div>
        </div>
      )}

      {/* ================================================================
          PRs TAB
          ================================================================ */}
      {tab === "prs" && (
        <div className="space-y-6">
          <div>
            <LabelMicro className="mb-2 block">Personal records</LabelMicro>
            <h2 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-foreground">
              {workoutsThisMonth > 0 ? `${workoutsThisMonth} this month.` : "No records yet."}
            </h2>
          </div>

          {hasPersonalRecords ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.personalRecords.map((record) => (
                <PrCard
                  key={`${record.exercise}-${record.date.toISOString()}`}
                  record={record}
                  weightUnitLabel={weightUnitLabel}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[14rem] items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted-foreground">
              Complete weighted sets in your workout logs to generate personal records.
            </div>
          )}

          {/* Strength progression below PR cards */}
          <StrengthChart analytics={data} weightUnitLabel={weightUnitLabel} />
        </div>
      )}
    </div>
  )
}
