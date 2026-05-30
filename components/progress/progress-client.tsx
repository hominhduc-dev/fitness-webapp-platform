"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import dynamic from "next/dynamic"

import { useAuth } from "@/components/providers/auth-provider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchProgressAnalytics,
  fetchProgressCalendar,
  fetchProgressYearView,
  fetchWorkoutLogDetail,
} from "@/lib/fitness/api"
import type {
  ProgressAnalytics,
  ProgressCalendar,
  ProgressCalendarLogStub,
  ProgressYearView,
} from "@/lib/fitness/types"
import type { WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"

const StrengthChart = dynamic(
  () => import("@/components/progress/strength-chart").then((mod) => mod.StrengthChart),
  {
    loading: () => <div className="min-h-[14rem] rounded-[10px] border border-border bg-card" />,
    ssr: false,
  },
)

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const EMPTY_ANALYTICS: ProgressAnalytics = {
  muscleGroupDistribution: [],
  personalRecords: [],
  strengthProgression: { points: [], series: [] },
  summary: { bestStreakDays: 0, currentStreakDays: 0, totalVolumeThisMonth: 0, workoutsThisMonth: 0 },
  weeklyVolume: [],
}

type WorkoutKind = "all" | "push" | "pull" | "legs"
type Tab = "history" | "year" | "prs"

const KIND_COLORS: Record<string, string> = {
  legs: "var(--chart-4)",
  pull: "var(--chart-3)",
  push: "var(--chart-1)",
}

function kindColor(k: string) {
  return KIND_COLORS[k] ?? "var(--muted-foreground)"
}

/** Derive workout "kind" — uses explicit field, falls back to name heuristic */
function inferKind(kindField: string | undefined | null, name: string): WorkoutKind {
  if (kindField === "push" || kindField === "pull" || kindField === "legs") return kindField
  if (kindField === "full_body" || kindField === "cardio" || kindField === "other") return "push" // neutral color fallback
  const lower = name.toLowerCase()
  if (/push|chest|shoulder|tricep/.test(lower)) return "push"
  if (/pull|back|bicep|row|deadlift/.test(lower)) return "pull"
  if (/leg|squat|quad|hamstring|glute|calf/.test(lower)) return "legs"
  return "push"
}

function formatYYYYMM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  )
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(date)
}

function formatDuration(mins: number) {
  if (mins <= 0) return "—"
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

// ---------------------------------------------------------------------------
// Micro building blocks
// ---------------------------------------------------------------------------

function LabelMicro({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("label-micro", className)}>{children}</span>
}

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

function Sparkline({ data, width = 220, height = 56 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 8) - 4])
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ")
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden className="block w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill="var(--chart-1)" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Stats summary row
// ---------------------------------------------------------------------------

function StatsSummary({
  calendar,
  prevCalendar,
}: {
  calendar: ProgressCalendar | null
  prevCalendar: ProgressCalendar | null
}) {
  const cur = calendar?.summary ?? { avgDurationMins: 0, totalVolume: 0, totalWorkouts: 0 }
  const prev = prevCalendar?.summary ?? { avgDurationMins: 0, totalVolume: 0, totalWorkouts: 0 }

  function delta(cur: number, prev: number) {
    if (prev === 0) return null
    const pct = Math.round(((cur - prev) / prev) * 100)
    return pct
  }

  const workoutDelta = delta(cur.totalWorkouts, prev.totalWorkouts)
  const volumeDelta = delta(cur.totalVolume, prev.totalVolume)

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {/* Workouts */}
      <div className="min-w-0 rounded-[10px] border border-border bg-card p-3 sm:p-4">
        <LabelMicro className="mb-2 block">Sessions</LabelMicro>
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 whitespace-nowrap font-mono text-[1.7rem] font-semibold leading-none tnum text-foreground sm:text-[2rem]">
            {cur.totalWorkouts}
          </span>
        </div>
        {workoutDelta !== null && (
          <div
            className={cn(
              "mt-2 font-mono text-[10px] leading-tight tnum sm:text-[11px]",
              workoutDelta >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]",
            )}
          >
            {workoutDelta >= 0 ? "+" : ""}
            {workoutDelta}% vs prev
          </div>
        )}
      </div>

      {/* Volume */}
      <div className="min-w-0 rounded-[10px] border border-border bg-card p-3 sm:p-4">
        <LabelMicro className="mb-2 block">Volume</LabelMicro>
        <div className="flex min-w-0 items-baseline gap-1">
          <span className="min-w-0 whitespace-nowrap font-mono text-[1.7rem] font-semibold leading-none tnum text-foreground sm:text-[2rem]">
            {formatVolume(cur.totalVolume)}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">kg</span>
        </div>
        {volumeDelta !== null && (
          <div
            className={cn(
              "mt-2 font-mono text-[10px] leading-tight tnum sm:text-[11px]",
              volumeDelta >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]",
            )}
          >
            {volumeDelta >= 0 ? "+" : ""}
            {volumeDelta}% vs prev
          </div>
        )}
      </div>

      {/* Avg duration */}
      <div className="min-w-0 rounded-[10px] border border-border bg-card p-3 sm:p-4">
        <LabelMicro className="mb-2 block">Avg duration</LabelMicro>
        <div className="whitespace-nowrap font-mono text-[1.55rem] font-semibold leading-none tnum text-foreground sm:text-[2rem]">
          {formatDuration(cur.avgDurationMins)}
        </div>
        {prev.avgDurationMins > 0 && (
          <div className="mt-2 font-mono text-[10px] leading-tight tnum text-muted-foreground sm:text-[11px]">
            prev {formatDuration(prev.avgDurationMins)}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workout log detail modal
// ---------------------------------------------------------------------------

function WorkoutLogModal({
  logId,
  accessToken,
  onClose,
}: {
  logId: string
  accessToken: string
  onClose: () => void
}) {
  const [log, setLog] = useState<WorkoutLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchWorkoutLogDetail(accessToken, logId)
      .then((data) => { if (!cancelled) { setLog(data); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message ?? "Failed to load"); setLoading(false) } })
    return () => { cancelled = true }
  }, [logId, accessToken])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  const startDate = log ? formatShortDate(log.startedAt) : ""
  const totalSets = log?.exercises.reduce((s, ex) => s + ex.sets.length, 0) ?? 0
  const completedSets = log?.exercises.reduce(
    (s, ex) => s + ex.sets.filter((set) => set.completed).length, 0,
  ) ?? 0

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/20 backdrop-blur-[2px] sm:items-center"
    >
      <div className="relative flex max-h-[calc(100svh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[16px] border border-border bg-background shadow-2xl sm:max-h-[82svh] sm:rounded-[16px]">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between border-b border-border p-5">
          <div>
            {loading ? (
              <Skeleton className="h-6 w-40 rounded" />
            ) : (
              <>
                <LabelMicro className="mb-1 block">{startDate}</LabelMicro>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {log?.workout.name ?? "Workout"}
                </h2>
                <div className="mt-1 font-mono text-[11px] tnum text-muted-foreground">
                  {completedSets}/{totalSets} sets completed
                  {log?.totalVolume ? ` · ${formatVolume(log.totalVolume)} kg total` : ""}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-[8px]" />)}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : log && log.exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exercise data recorded.</p>
          ) : (
            <div className="space-y-4">
              {log?.exercises.map((ex, i) => (
                <div key={ex.id ?? i}>
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: kindColor(inferKind(ex.exercise.muscleGroup, ex.exercise.name)) }}
                    />
                    <span className="text-sm font-medium text-foreground">{ex.exercise.name}</span>
                    <span className="label-micro ml-auto">{ex.exercise.muscleGroup}</span>
                  </div>
                  <div className="overflow-x-auto rounded-[6px] border border-border">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="label-micro px-3 py-2">Set</th>
                          <th className="label-micro px-3 py-2">Weight</th>
                          <th className="label-micro px-3 py-2">Reps</th>
                          <th className="label-micro px-3 py-2">Done</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ex.sets.map((set, si) => (
                          <tr
                            key={set.id ?? si}
                            className={cn(
                              "border-b border-border last:border-0",
                              set.completed ? "" : "opacity-40",
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-[12px] tnum text-muted-foreground">
                              {set.setNumber}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px] font-medium tnum text-foreground">
                              {set.weight != null ? `${set.weight} kg` : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px] tnum text-foreground">
                              {set.actualReps ?? set.targetReps}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  "h-4 w-4 rounded-sm border",
                                  set.completed
                                    ? "border-[var(--success)] bg-[var(--success)]/10"
                                    : "border-border",
                                )}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar section
// ---------------------------------------------------------------------------

function CalendarSection({
  year,
  month,
  filter,
  calendar,
  calendarLoading,
  onDayClick,
}: {
  year: number
  month: number
  filter: WorkoutKind
  calendar: ProgressCalendar | null
  calendarLoading: boolean
  onDayClick: (logs: ProgressCalendarLogStub[]) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  // Build a map: day → logs for that day
  const dayToLogs = useMemo(() => {
    const map = new Map<number, ProgressCalendarLogStub[]>()
    if (!calendar) return map
    for (const d of calendar.days) {
      const dayNum = parseInt(d.date.split("-")[2], 10)
      map.set(dayNum, d.logs)
    }
    return map
  }, [calendar])

  const cells: Array<number | null> = Array.from({ length: firstDayOfWeek }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="rounded-[10px] border border-border bg-card p-5">
      {calendarLoading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-[6px]" />
          ))}
        </div>
      ) : (
        <>
          {/* Day-of-week headers */}
          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <div key={d} className="label-micro py-1.5 text-center">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`pad-${i}`} />

              const logs = dayToLogs.get(day) ?? []
              const hasWorkout = logs.length > 0

              // Filter: hide days that don't match selected kind
              const matchingLogs =
                filter === "all"
                  ? logs
                  : logs.filter((l) => inferKind(l.workoutKind, l.workoutName) === filter)
              const dim = hasWorkout && filter !== "all" && matchingLogs.length === 0

              const isToday = isCurrentMonth && day === today.getDate()
              const dotKind = matchingLogs.length > 0
                ? inferKind(matchingLogs[0].workoutKind, matchingLogs[0].workoutName)
                : hasWorkout
                ? inferKind(logs[0].workoutKind, logs[0].workoutName)
                : null

              return (
                <button
                  key={day}
                  type="button"
                  onMouseEnter={() => setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { if (logs.length > 0) onDayClick(logs) }}
                  className={cn(
                    "relative flex aspect-square flex-col items-start justify-between rounded-[6px] border p-1.5 text-left transition-colors",
                    isToday
                      ? "border-primary border-[1.5px] text-primary"
                      : "border-border text-foreground hover:bg-muted",
                    hovered === day && !isToday && "bg-muted",
                    dim && "opacity-35",
                    hasWorkout && !dim && "cursor-pointer",
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
                  {dotKind && !dim && (
                    <span
                      className="self-end rounded-full"
                      style={{ width: 6, height: 6, background: kindColor(dotKind) }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 border-t border-border pt-3.5">
        {(["push", "pull", "legs"] as const).map((k) => (
          <div key={k} className="label-micro inline-flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: 6, height: 6, background: kindColor(k), display: "inline-block" }} />
            {k[0].toUpperCase() + k.slice(1)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent sessions sidebar
// ---------------------------------------------------------------------------

function RecentSessions({
  calendar,
  calendarLoading,
  onLogClick,
}: {
  calendar: ProgressCalendar | null
  calendarLoading: boolean
  onLogClick: (logId: string) => void
}) {
  // Collect all logs from calendar days, sorted by startedAt desc
  const logs = useMemo(() => {
    if (!calendar) return []
    return calendar.days
      .flatMap((d) => d.logs)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 8)
  }, [calendar])

  if (calendarLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-[8px]" />)}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted-foreground">
        No sessions this month.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => {
        const date = new Date(log.startedAt)
        const dateLabel = formatShortDate(date)
        const kind = inferKind(log.workoutKind, log.workoutName)

        return (
          <button
            key={log.id}
            type="button"
            onClick={() => onLogClick(log.id)}
            className="flex w-full cursor-pointer items-center gap-3.5 rounded-[8px] border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
          >
            {/* Date column */}
            <div className="w-9 shrink-0 text-center">
              <div className="label-micro leading-tight">{dateLabel.split(" ")[0]}</div>
              <div className="font-mono text-[17px] font-semibold leading-tight tnum text-foreground">
                {dateLabel.split(" ")[1]}
              </div>
            </div>

            {/* Colored bar */}
            <div className="h-8 w-1 shrink-0 rounded-sm" style={{ background: kindColor(kind) }} />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{log.workoutName}</div>
              <div className="mt-0.5 font-mono text-[11px] tnum text-muted-foreground">
                {log.totalVolume > 0 ? `${formatVolume(log.totalVolume)} kg` : "—"}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Year view (GitHub-style contribution graph)
// ---------------------------------------------------------------------------

function YearView({
  yearView,
  yearViewLoading,
  year,
  onDayClick,
}: {
  yearView: ProgressYearView | null
  yearViewLoading: boolean
  year: number
  onDayClick?: (date: string) => void
}) {
  // Build a 53-column × 7-row grid (Mon-start weeks)
  const grid = useMemo(() => {
    // Map date → count
    const countMap = new Map<string, number>()
    if (yearView) {
      for (const d of yearView.days) {
        countMap.set(d.date, d.count)
      }
    }

    // Find start: Jan 1 of year, rolled back to Monday
    const jan1 = new Date(Date.UTC(year, 0, 1))
    const jan1DayOfWeek = jan1.getUTCDay() // 0=Sun
    // Use Mon as start of week
    const startOffset = (jan1DayOfWeek + 6) % 7 // days back to reach Mon
    const gridStart = new Date(jan1.getTime() - startOffset * 86_400_000)

    const weeks: Array<Array<{ date: string; count: number } | null>> = []
    let col: Array<{ date: string; count: number } | null> = []
    const gridEnd = new Date(Date.UTC(year + 1, 0, 1))

    let cursor = new Date(gridStart)
    while (cursor < gridEnd || col.length > 0) {
      const yyyy = cursor.getUTCFullYear()
      const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0")
      const dd = String(cursor.getUTCDate()).padStart(2, "0")
      const dateStr = `${yyyy}-${mm}-${dd}`
      const inYear = cursor.getUTCFullYear() === year

      col.push(inYear ? { date: dateStr, count: countMap.get(dateStr) ?? 0 } : null)

      if (col.length === 7) {
        weeks.push(col)
        col = []
      }

      cursor = new Date(cursor.getTime() + 86_400_000)
      if (cursor >= gridEnd && col.length === 0) break
    }
    if (col.length > 0) {
      while (col.length < 7) col.push(null)
      weeks.push(col)
    }

    return weeks
  }, [year, yearView])

  // Max count for intensity scaling
  const maxCount = useMemo(() => {
    if (!yearView || yearView.days.length === 0) return 1
    return Math.max(...yearView.days.map((d) => d.count), 1)
  }, [yearView])

  function intensity(count: number): string {
    if (count === 0) return "var(--muted)"
    const ratio = count / maxCount
    if (ratio < 0.25) return "color-mix(in srgb, var(--primary) 30%, var(--muted))"
    if (ratio < 0.5) return "color-mix(in srgb, var(--primary) 55%, var(--muted))"
    if (ratio < 0.75) return "color-mix(in srgb, var(--primary) 78%, var(--muted))"
    return "var(--primary)"
  }

  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  // Find first week index for each month
  const monthPositions = useMemo(() => {
    const positions: { month: string; colIndex: number }[] = []
    let lastMonth = -1
    grid.forEach((week, ci) => {
      for (const cell of week) {
        if (cell) {
          const m = parseInt(cell.date.split("-")[1], 10) - 1
          if (m !== lastMonth) {
            positions.push({ colIndex: ci, month: MONTH_LABELS[m] })
            lastMonth = m
          }
          break
        }
      }
    })
    return positions
  }, [grid])

  const totalWorkouts = yearView?.days.reduce((s, d) => s + d.count, 0) ?? 0

  return (
    <div className="rounded-[10px] border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <LabelMicro>{year} activity</LabelMicro>
        <span className="font-mono text-[11px] tnum text-muted-foreground">
          {totalWorkouts} {totalWorkouts === 1 ? "session" : "sessions"}
        </span>
      </div>

      {yearViewLoading ? (
        <Skeleton className="h-28 w-full rounded-[6px]" />
      ) : (
        <div className="w-full overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Month labels */}
            <div className="relative mb-1 flex h-4" style={{ paddingLeft: 28 }}>
              {monthPositions.map(({ month, colIndex }) => (
                <div
                  key={month}
                  className="absolute label-micro"
                  style={{ left: 28 + colIndex * 14 }}
                >
                  {month}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-0.5" style={{ paddingLeft: 28 }}>
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((cell, di) => {
                    if (!cell) return <div key={di} className="h-3 w-3 rounded-[2px]" />
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        title={cell.count > 0 ? `${cell.date}: ${cell.count} session${cell.count > 1 ? "s" : ""}` : cell.date}
                        onClick={() => cell.count > 0 && onDayClick?.(cell.date)}
                        className="h-3 w-3 rounded-[2px] transition-opacity hover:opacity-80"
                        style={{ background: intensity(cell.count) }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Day labels on left */}
            <div
              className="absolute flex flex-col gap-0.5"
              style={{ top: 0, left: 0, marginTop: 20 }}
            >
              {["M", "", "W", "", "F", "", ""].map((label, i) => (
                <div key={i} className="flex h-3 w-6 items-center justify-end pr-1">
                  <span className="label-micro text-[9px]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Intensity legend */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3.5">
        <LabelMicro>Less</LabelMicro>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <div
            key={i}
            className="h-3 w-3 rounded-[2px]"
            style={{ background: intensity(ratio) }}
          />
        ))}
        <LabelMicro>More</LabelMicro>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PR card + strength chart (unchanged from original)
// ---------------------------------------------------------------------------

function PrCard({
  record,
  weightUnitLabel,
}: {
  record: ProgressAnalytics["personalRecords"][number]
  weightUnitLabel: string
}) {
  const sparkData = [
    record.weight * 0.88,
    record.weight * 0.92,
    record.weight * 0.95,
    record.weight * 0.97,
    record.weight,
  ]

  return (
    <div className="flex flex-col gap-3.5 rounded-[10px] border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="label-micro">{record.exercise}</span>
        <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--accent-foreground)]">
          PR
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[2.5rem] font-semibold leading-none tnum text-foreground">
          {record.weight}
        </span>
        <span className="text-sm text-muted-foreground">{weightUnitLabel}</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] tnum">
        <span className="text-[var(--success)]">↑ set {formatShortDate(record.date)}</span>
      </div>
      <div className="mt-1">
        <Sparkline data={sparkData} height={48} />
      </div>
      <div className="label-micro flex justify-between">
        <span>Earlier</span>
        <span>Now</span>
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
        <Skeleton className="h-9 w-64 rounded" />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[10px]" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[26rem] rounded-[10px]" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-[8px]" />)}
        </div>
      </div>
    </div>
  )
}

function ProgressPrsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-8 w-48 rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-44 rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-[10px]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export type ProgressClientInitialData = {
  calendar: ProgressCalendar
  prevCalendar: ProgressCalendar | null
  viewMonth: number
  viewYear: number
  weightUnitLabel: string
}

export function ProgressClient({ initialData }: { initialData: ProgressClientInitialData }) {
  const { isLoading: authLoading, session } = useAuth()
  const hasConsumedInitialCalendar = useRef(false)
  const hasConsumedInitialPrevCalendar = useRef(false)

  // Analytics (PRs + strength)
  const [analytics, setAnalytics] = useState<ProgressAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // Month navigation
  const now = new Date()
  const [viewYear, setViewYear] = useState(initialData.viewYear)
  const [viewMonth, setViewMonth] = useState(initialData.viewMonth) // 1-based

  // Calendar (current + prev month for stats comparison)
  const [calendar, setCalendar] = useState<ProgressCalendar | null>(initialData.calendar)
  const [prevCalendar, setPrevCalendar] = useState<ProgressCalendar | null>(initialData.prevCalendar)
  const [calendarLoading, setCalendarLoading] = useState(false)

  // Year view
  const [yearView, setYearView] = useState<ProgressYearView | null>(null)
  const [yearViewLoading, setYearViewLoading] = useState(true)
  const [yearViewYear, setYearViewYear] = useState(now.getFullYear())

  // UI state
  const [tab, setTab] = useState<Tab>("history")
  const [filter, setFilter] = useState<WorkoutKind>("all")
  const [error, setError] = useState<string | null>(null)

  // Modal
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  const weightUnitLabel = initialData.weightUnitLabel
  const token = session?.access_token

  // Load analytics only when the PR tab needs it. This query parses workout
  // snapshots across history, so keeping it out of the initial History view
  // makes first paint depend only on the month calendar.
  useEffect(() => {
    if (authLoading || !token || tab !== "prs" || analytics) return
    let cancelled = false
    setAnalyticsLoading(true)
    fetchProgressAnalytics(token)
      .then((d) => { if (!cancelled) { setAnalytics(d); setAnalyticsLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message); setAnalyticsLoading(false) } })
    return () => { cancelled = true }
  }, [analytics, authLoading, tab, token])

  // Load calendar when month changes
  useEffect(() => {
    if (authLoading || !token) return

    if (
      !hasConsumedInitialCalendar.current &&
      viewYear === initialData.viewYear &&
      viewMonth === initialData.viewMonth
    ) {
      hasConsumedInitialCalendar.current = true
      return
    }

    let cancelled = false
    setCalendarLoading(true)
    setPrevCalendar(null)

    fetchProgressCalendar(token, viewYear, viewMonth)
      .then((cur) => {
        if (!cancelled) {
          setCalendar(cur)
          setCalendarLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message); setCalendarLoading(false) }
      })

    return () => { cancelled = true }
  }, [authLoading, initialData.viewMonth, initialData.viewYear, token, viewYear, viewMonth])

  // Load previous month summary in the background for "vs prev" metrics.
  useEffect(() => {
    if (authLoading || !token || calendarLoading) return

    if (
      !hasConsumedInitialPrevCalendar.current &&
      viewYear === initialData.viewYear &&
      viewMonth === initialData.viewMonth
    ) {
      hasConsumedInitialPrevCalendar.current = true
      return
    }

    let cancelled = false

    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear

    fetchProgressCalendar(token, prevYear, prevMonth, { summaryOnly: true })
      .then((prev) => {
        if (!cancelled) setPrevCalendar(prev)
      })
      .catch(() => {
        if (!cancelled) setPrevCalendar(null)
      })

    return () => { cancelled = true }
  }, [authLoading, calendarLoading, initialData.viewMonth, initialData.viewYear, token, viewMonth, viewYear])

  // Load year view when year tab is active
  useEffect(() => {
    if (authLoading || !token || tab !== "year") return
    let cancelled = false
    setYearViewLoading(true)
    fetchProgressYearView(token, yearViewYear)
      .then((d) => { if (!cancelled) { setYearView(d); setYearViewLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message); setYearViewLoading(false) } })
    return () => { cancelled = true }
  }, [authLoading, token, tab, yearViewYear])

  // Month nav helpers
  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 1) { setViewYear((y) => y - 1); return 12 }
      return m - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 12) { setViewYear((y) => y + 1); return 1 }
      return m + 1
    })
  }, [])

  const isCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1

  // Handle day click in calendar → open modal for first log of that day
  const handleDayClick = useCallback((logs: ProgressCalendarLogStub[]) => {
    if (logs.length > 0) setSelectedLogId(logs[0].id)
  }, [])

  // Handle year-view day click → navigate calendar to that month
  const handleYearDayClick = useCallback((date: string) => {
    const [y, m] = date.split("-").map(Number)
    setViewYear(y)
    setViewMonth(m)
    setTab("history")
  }, [])

  const data = analytics ?? EMPTY_ANALYTICS

  if (authLoading || (calendarLoading && calendar == null)) {
    return <ProgressPageSkeleton />
  }

  return (
    <>
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">

        {/* ---- Page header ---- */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div>
              <LabelMicro className="mb-1 block">{monthLabel(viewYear, viewMonth)}</LabelMicro>
              <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
                {calendarLoading
                  ? "—"
                  : `${calendar?.summary.totalWorkouts ?? 0} ${(calendar?.summary.totalWorkouts ?? 0) === 1 ? "session" : "sessions"}`
                }
              </h1>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {(["all", "push", "pull", "legs"] as WorkoutKind[]).map((k) => (
              <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                {k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}
              </Chip>
            ))}
          </div>
        </div>

        {/* ---- Stats summary ---- */}
        <div className="mb-6">
          <StatsSummary calendar={calendar} prevCalendar={prevCalendar} />
        </div>

        {/* ---- Tab strip ---- */}
        <div className="mb-6 flex gap-1 border-b border-border">
          {(["history", "year", "prs"] as Tab[]).map((t) => (
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
              {t === "history" ? "History" : t === "year" ? "Year view" : "Personal records"}
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
            <CalendarSection
              year={viewYear}
              month={viewMonth}
              filter={filter}
              calendar={calendar}
              calendarLoading={calendarLoading}
              onDayClick={handleDayClick}
            />

            <div>
              <LabelMicro className="mb-3 block">Recent</LabelMicro>
              <RecentSessions
                calendar={calendar}
                calendarLoading={calendarLoading}
                onLogClick={setSelectedLogId}
              />
            </div>
          </div>
        )}

        {/* ================================================================
            YEAR VIEW TAB
            ================================================================ */}
        {tab === "year" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setYearViewYear((y) => y - 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Previous year"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-sm font-medium tnum text-foreground">{yearViewYear}</span>
              <button
                type="button"
                onClick={() => setYearViewYear((y) => y + 1)}
                disabled={yearViewYear >= now.getFullYear()}
                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
                aria-label="Next year"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <YearView
                yearView={yearView}
                yearViewLoading={yearViewLoading}
                year={yearViewYear}
                onDayClick={handleYearDayClick}
              />
            </div>
          </div>
        )}

        {/* ================================================================
            PRs TAB
            ================================================================ */}
        {tab === "prs" && (
          analyticsLoading ? (
            <ProgressPrsSkeleton />
          ) : (
          <div className="space-y-6">
            <div>
              <LabelMicro className="mb-2 block">Personal records</LabelMicro>
              <h2 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-foreground">
                {data.personalRecords.length > 0
                  ? `${data.personalRecords.length} tracked.`
                  : "No records yet."}
              </h2>
            </div>

            {data.personalRecords.length > 0 ? (
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

            <StrengthChart analytics={data} weightUnitLabel={weightUnitLabel} />
          </div>
          )
        )}
      </div>

      {/* ---- Workout log detail modal ---- */}
      {selectedLogId && token && (
        <WorkoutLogModal
          logId={selectedLogId}
          accessToken={token}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </>
  )
}
