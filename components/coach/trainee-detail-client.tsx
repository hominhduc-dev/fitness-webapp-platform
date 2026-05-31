"use client"

import type React from "react"
import Link from "next/link"
import {
  Award,
  BarChart3,
  ClipboardCheck,
  Download,
  Loader2,
  Scale,
  StickyNote,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TraineeWorkoutLogsPanel } from "@/components/coach/trainee-workout-logs-panel"
import { useAuth } from "@/components/providers/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  assignCoachProgram,
  createCoachBodyMetric,
  createCoachCheckIn,
  fetchCoachWorkoutLogs,
  unassignCoachProgram,
} from "@/lib/fitness/api"
import type { BodyMetricEntry, CoachCheckIn, CoachProgram, CoachTraineeDetail } from "@/lib/fitness/types"
import type { WorkoutLog } from "@/lib/types"

type CoachTraineeDetailClientProps = {
  coachPrograms: CoachProgram[]
  initialDetail: CoachTraineeDetail
}

type BodyMetricFormState = {
  bodyFatPct: string
  chestCm: string
  hipsCm: string
  note: string
  recordedAt: string
  thighCm: string
  waistCm: string
  weightKg: string
}

type CheckInFormState = {
  adherenceScore: string
  checkInDate: string
  energyScore: string
  feedback: string
  moodScore: string
  nextFocus: string
  recoveryScore: string
  summary: string
}

function toDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function formatNumber(value?: number, suffix = "") {
  return value != null ? `${value}${suffix}` : "--"
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function createDefaultMetricForm(): BodyMetricFormState {
  return {
    bodyFatPct: "",
    chestCm: "",
    hipsCm: "",
    note: "",
    recordedAt: toDateInputValue(),
    thighCm: "",
    waistCm: "",
    weightKg: "",
  }
}

function createDefaultCheckInForm(): CheckInFormState {
  return {
    adherenceScore: "",
    checkInDate: toDateInputValue(),
    energyScore: "",
    feedback: "",
    moodScore: "",
    nextFocus: "",
    recoveryScore: "",
    summary: "",
  }
}

function averageScore(checkIn: CoachCheckIn) {
  const values = [
    checkIn.adherenceScore,
    checkIn.energyScore,
    checkIn.recoveryScore,
    checkIn.moodScore,
  ].filter((value): value is number => value != null)

  if (values.length === 0) {
    return null
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/* ─── Weekly bar chart (pure CSS, no Recharts) ───────────────────────────── */
type WeeklyBarChartProps = {
  data: number[]
}

/** Returns [Mon, Tue, Wed, Thu, Fri, Sat, Sun] Date objects for the current week */
function getCurrentWeekDates(): Date[] {
  const today = new Date()
  const day = today.getDay() // 0 = Sun
  // Offset so Monday = index 0
  const mondayOffset = day === 0 ? -6 : 1 - day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + mondayOffset + i)
    return d
  })
}

function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  const max = Math.max(...data, 1)
  const today = new Date()
  const todayDateNum = today.getDate()
  const weekDates = getCurrentWeekDates()

  const chartData = weekDates.map((date, i) => ({
    dateNum: date.getDate(),
    sets: data[i] ?? 0,
    isToday: date.getDate() === todayDateNum && date.getMonth() === today.getMonth(),
  }))

  return (
    <div className="grid grid-cols-7 items-end gap-2" style={{ height: 110 }}>
      {chartData.map(({ dateNum, sets, isToday }) => {
        const heightPct = sets === 0 ? 4 : (sets / max) * 90
        return (
          <div key={dateNum} className="flex h-full flex-col items-center justify-end gap-1.5">
            <div className="relative flex w-full items-end" style={{ height: "90%" }}>
              <div
                className={cn(
                  "w-full rounded-[3px] transition-all",
                  sets === 0
                    ? "bg-border"
                    : isToday
                      ? "bg-primary"
                      : "bg-foreground",
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums tracking-tight",
                isToday ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {dateNum}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Key lift card ─────────────────────────────────────────────────────── */
type KeyLift = {
  name: string
  value: string | number
  delta?: string | number | null
  isNew?: boolean
}

type KeyLiftCardProps = {
  lift: KeyLift
}

function KeyLiftCard({ lift }: KeyLiftCardProps) {
  const deltaStr = lift.delta != null ? String(lift.delta) : null
  const isPositive = deltaStr != null && deltaStr.startsWith("+") && deltaStr !== "+0.0" && deltaStr !== "+0"
  const isNegative = deltaStr != null && (deltaStr.startsWith("−") || deltaStr.startsWith("-"))
  const isFlat = deltaStr != null && !isPositive && !isNegative
  const deltaDisplay = isFlat ? "flat" : (deltaStr ?? null)

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {lift.name}
        </span>
        {lift.isNew && (
          <Badge variant="micro" className="bg-primary/10 text-primary border-primary/20">
            PR
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {lift.value}
        </span>
        {deltaDisplay && (
          <span
            className={cn(
              "font-mono text-xs",
              isPositive && "text-success",
              isNegative && "text-destructive",
              isFlat && "text-muted-foreground",
            )}
          >
            {deltaDisplay}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Recent sessions table ─────────────────────────────────────────────── */
type RecentSession = {
  date: string
  kind: string
  volume: number
  prs: number
  complete: number
}

type RecentSessionsTableProps = {
  sessions: RecentSession[]
}

function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        No sessions recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_100px_80px_32px] gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Date</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Type</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Volume</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Done</span>
        <span />
      </div>
      {sessions.map((s, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-[80px_1fr_100px_80px_32px] items-center gap-3 px-4 py-3",
            i < sessions.length - 1 && "border-b border-border",
          )}
        >
          <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {s.date}
          </span>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {s.kind} day
            {s.prs > 0 && (
              <Badge variant="micro" className="bg-primary/10 text-primary border-primary/20">
                {s.prs} PR
              </Badge>
            )}
          </div>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {(s.volume / 1000).toFixed(1)}k kg
          </span>
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              s.complete >= 1 ? "text-success" : "text-amber-600",
            )}
          >
            {Math.round(s.complete * 100)}%
          </span>
          <Award className="h-[14px] w-[14px] text-muted-foreground/40" />
        </div>
      ))}
    </div>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */
export function CoachTraineeDetailClient({
  coachPrograms,
  initialDetail,
}: CoachTraineeDetailClientProps) {
  const { session } = useAuth()
  const [detail, setDetail] = useState(initialDetail)
  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [metricForm, setMetricForm] = useState<BodyMetricFormState>(createDefaultMetricForm)
  const [checkInForm, setCheckInForm] = useState<CheckInFormState>(createDefaultCheckInForm)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [metricError, setMetricError] = useState<string | null>(null)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingProgramId, setRemovingProgramId] = useState<string | null>(null)
  const [exportingProgramId, setExportingProgramId] = useState<string | null>(null)
  const [isSavingMetric, setIsSavingMetric] = useState(false)
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false)

  const assignedProgramIds = new Set(detail.programs.map((program) => program.id))
  const assignablePrograms = coachPrograms.filter((program) => !assignedProgramIds.has(program.id))
  const latestMetric = detail.bodyMetrics[0]
  const previousMetric = detail.bodyMetrics[1]
  const latestWeightDelta =
    latestMetric?.weightKg != null && previousMetric?.weightKg != null
      ? latestMetric.weightKg - previousMetric.weightKg
      : null
  const plannedSessionsPerWeek = detail.programs.reduce(
    (sum, program) => sum + program.workoutsPerWeek,
    0,
  )
  const completionRate =
    plannedSessionsPerWeek > 0
      ? Math.min(100, Math.round((detail.trainee.thisWeekWorkouts / plannedSessionsPerWeek) * 100))
      : detail.progressSummary.completionRate

  // Build synthetic weekly activity from progressSummary data
  // We distribute workoutsLast7Days across a 7-day array (best-effort approximation)
  const weeklyData: number[] = Array.from({ length: 7 }, (_, i) => {
    // Use recentLogs to build day-by-day sets count for the last 7 days
    const today = new Date()
    const dayDate = new Date(today)
    dayDate.setDate(today.getDate() - (6 - i))
    const dayKey = dayDate.toISOString().slice(0, 10)
    const dayLogs = detail.recentLogs.filter((log) => {
      const logDate = log.startedAt instanceof Date ? log.startedAt : new Date(log.startedAt)
      return logDate.toISOString().slice(0, 10) === dayKey
    })
    return dayLogs.reduce((sum, log) => {
      return sum + log.exercises.reduce((eSum, ex) => eSum + ex.sets.filter((s) => s.completed).length, 0)
    }, 0)
  })

  // Build key lifts from body metrics weight as proxy (no dedicated key-lift API)
  const keyLifts: KeyLift[] = [
    {
      name: "Weight",
      value: latestMetric?.weightKg != null ? `${latestMetric.weightKg} kg` : "--",
      delta:
        latestWeightDelta != null
          ? `${latestWeightDelta >= 0 ? "+" : ""}${latestWeightDelta.toFixed(1)}`
          : null,
    },
    {
      name: "Body fat",
      value: latestMetric?.bodyFatPct != null ? `${latestMetric.bodyFatPct}%` : "--",
      delta: null,
    },
    {
      name: "Waist",
      value: latestMetric?.waistCm != null ? `${latestMetric.waistCm} cm` : "--",
      delta: null,
    },
  ]

  // Build recent sessions from recentLogs
  const recentSessions: RecentSession[] = detail.recentLogs.slice(0, 6).map((log) => {
    const completedSets = log.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
      0,
    )
    const totalSets = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    return {
      date: (log.startedAt instanceof Date ? log.startedAt : new Date(log.startedAt)).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" },
      ),
      kind: log.workout?.name ?? "Workout",
      volume: Number(log.totalVolume ?? 0),
      prs: 0,
      complete: totalSets > 0 ? completedSets / totalSets : 1,
    }
  })

  // Latest coach note from most recent check-in feedback
  const latestNote = detail.checkIns[0]?.feedback ?? null

  async function handleAssignProgram() {
    if (!session?.access_token || !selectedProgramId) {
      return
    }

    setIsAssigning(true)
    setAssignError(null)

    try {
      await assignCoachProgram(session.access_token, selectedProgramId, detail.trainee.id)
      const assignedProgram = coachPrograms.find((program) => program.id === selectedProgramId)

      if (assignedProgram) {
        setDetail((current) => ({
          ...current,
          programs: [assignedProgram, ...current.programs],
        }))
      }

      setSelectedProgramId("")
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Could not assign program.")
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleExportProgramLogs(program: CoachProgram) {
    if (!session?.access_token) return
    setExportingProgramId(program.id)

    try {
      const assignment = program.assignedTrainees.find((t) => t.id === detail.trainee.id)
      const from = assignment
        ? assignment.assignedAt.toISOString().slice(0, 10)
        : new Date(Date.now() - program.duration * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      // Upper bound: program end date OR tomorrow — always exclusive (+1 day)
      // so that logs recorded *today* (same day as assignedAt or today) are included.
      const endDate = new Date(from)
      endDate.setDate(endDate.getDate() + program.duration * 7)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const toDate = endDate < tomorrow ? endDate : tomorrow
      const to = toDate.toISOString().slice(0, 10)

      const allLogs: WorkoutLog[] = []
      let cursor: string | undefined
      for (let page = 0; page < 20; page++) {
        const result = await fetchCoachWorkoutLogs(session.access_token, detail.trainee.id, { cursor, from, limit: 50, to })
        allLogs.push(...result.logs)
        if (!result.nextCursor) break
        cursor = result.nextCursor
      }

      if (allLogs.length === 0) {
        setAssignError(`${detail.trainee.name} chưa có buổi tập nào trong program này.`)
        return
      }

      const { downloadWorkoutLogs } = await import("@/components/workout-export-excel")
      await downloadWorkoutLogs(allLogs, {
        from,
        label: program.name,
        subjectName: detail.trainee.name,
        to,
      })
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Không thể export logs.")
    } finally {
      setExportingProgramId(null)
    }
  }

  async function handleUnassignProgram(programId: string) {
    if (!session?.access_token) {
      return
    }

    setRemovingProgramId(programId)
    setAssignError(null)

    try {
      await unassignCoachProgram(session.access_token, programId, detail.trainee.id)
      setDetail((current) => ({
        ...current,
        programs: current.programs.filter((program) => program.id !== programId),
      }))
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Could not remove program.")
    } finally {
      setRemovingProgramId(null)
    }
  }

  async function handleCreateBodyMetric(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session?.access_token) {
      return
    }

    setIsSavingMetric(true)
    setMetricError(null)

    try {
      const bodyMetric = await createCoachBodyMetric(session.access_token, detail.trainee.id, {
        bodyFatPct: parseOptionalNumber(metricForm.bodyFatPct),
        chestCm: parseOptionalNumber(metricForm.chestCm),
        hipsCm: parseOptionalNumber(metricForm.hipsCm),
        note: metricForm.note.trim() || undefined,
        recordedAt: metricForm.recordedAt,
        thighCm: parseOptionalNumber(metricForm.thighCm),
        waistCm: parseOptionalNumber(metricForm.waistCm),
        weightKg: parseOptionalNumber(metricForm.weightKg),
      })

      setDetail((current) => ({
        ...current,
        bodyMetrics: [bodyMetric, ...current.bodyMetrics],
      }))
      setMetricForm(createDefaultMetricForm())
    } catch (error) {
      setMetricError(error instanceof Error ? error.message : "Could not save body metrics.")
    } finally {
      setIsSavingMetric(false)
    }
  }

  async function handleCreateCheckIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session?.access_token) {
      return
    }

    setIsSavingCheckIn(true)
    setCheckInError(null)

    try {
      const checkIn = await createCoachCheckIn(session.access_token, detail.trainee.id, {
        adherenceScore: parseOptionalNumber(checkInForm.adherenceScore),
        checkInDate: checkInForm.checkInDate,
        energyScore: parseOptionalNumber(checkInForm.energyScore),
        feedback: checkInForm.feedback.trim(),
        moodScore: parseOptionalNumber(checkInForm.moodScore),
        nextFocus: checkInForm.nextFocus.trim() || undefined,
        recoveryScore: parseOptionalNumber(checkInForm.recoveryScore),
        summary: checkInForm.summary.trim() || undefined,
      })

      setDetail((current) => ({
        ...current,
        checkIns: [checkIn, ...current.checkIns],
      }))
      setCheckInForm(createDefaultCheckInForm())
    } catch (error) {
      setCheckInError(error instanceof Error ? error.message : "Could not save check-in.")
    } finally {
      setIsSavingCheckIn(false)
    }
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5 bg-muted/50">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="metrics">Body metrics</TabsTrigger>
        <TabsTrigger value="checkins">Check-ins</TabsTrigger>
        <TabsTrigger value="logs">Workout logs</TabsTrigger>
      </TabsList>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview" className="space-y-6">
        {/* Coach note */}
        {latestNote && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-foreground">{latestNote}</p>
          </div>
        )}

        {/* Weekly activity chart */}
        <div className="rounded-lg border border-border p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                This week · sets per day
              </p>
              <p className="mt-1.5 font-mono text-[22px] font-medium tabular-nums text-foreground">
                {weeklyData.reduce((a, b) => a + b, 0)}{" "}
                <span className="text-sm font-normal text-muted-foreground">sets</span>
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {detail.trainee.thisWeekWorkouts}/{plannedSessionsPerWeek || 0} sessions
            </span>
          </div>
          <WeeklyBarChart data={weeklyData} />
        </div>

        {/* Key lifts */}
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Key metrics
          </p>
          <div className="grid grid-cols-3 gap-3">
            {keyLifts.map((lift) => (
              <KeyLiftCard key={lift.name} lift={lift} />
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Recent sessions
          </p>
          <RecentSessionsTable sessions={recentSessions} />
        </div>

        {/* Assigned programs */}
        <div className="rounded-lg border border-border p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">Assigned programs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Assign or remove programs from this client.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-full min-w-[240px]">
                  <SelectValue placeholder="Select a program to assign" />
                </SelectTrigger>
                <SelectContent>
                  {assignablePrograms.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => void handleAssignProgram()}
                disabled={!selectedProgramId || isAssigning}
              >
                {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Assign program
              </Button>
            </div>
          </div>

          {assignError ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {assignError}
            </div>
          ) : null}

          {detail.programs.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No programs assigned to this client yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {detail.programs.map((program) => (
                <div
                  key={program.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{program.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {program.workoutsPerWeek} workouts/week · {program.duration} weeks · {program.difficulty}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="w-full bg-transparent sm:w-auto"
                      onClick={() => void handleExportProgramLogs(program)}
                      disabled={exportingProgramId === program.id}
                    >
                      {exportingProgramId === program.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Download className="mr-2 h-4 w-4" />}
                      Export logs
                    </Button>
                    <Link href={`/coach/programs/${program.id}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full bg-transparent">
                        Open plan
                      </Button>
                    </Link>
                    <Link href={`/coach/programs/${program.id}?adjustTrainee=${detail.trainee.id}`} className="w-full sm:w-auto">
                      <Button className="w-full">
                        Adjust plan
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void handleUnassignProgram(program.id)}
                      disabled={removingProgramId === program.id}
                    >
                      {removingProgramId === program.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* ── Progress ──────────────────────────────────────────────────────── */}
      <TabsContent value="progress" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">7-day</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {detail.progressSummary.workoutsLast7Days}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Workouts in the last 7 days</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">30-day volume</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {Math.round(detail.progressSummary.totalVolumeLast30Days).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Total logged volume</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">30-day sessions</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {detail.progressSummary.workoutsLast30Days}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Completed sessions</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">Latest workout</span>
            </div>
            <p className="mt-3 font-mono text-lg font-semibold">
              {detail.progressSummary.latestWorkoutAt
                ? detail.progressSummary.latestWorkoutAt.toLocaleDateString()
                : "--"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Most recent completed workout</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Weekly compliance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare completed workouts with the currently assigned weekly plan.
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold tabular-nums">{completionRate}%</p>
              <p className="font-mono text-xs text-muted-foreground">
                {detail.trainee.thisWeekWorkouts}/{plannedSessionsPerWeek || 0} sessions
              </p>
            </div>
          </div>
          <Progress value={completionRate} className="mt-5 h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-primary" />
        </div>

        <RecentActivity logs={detail.recentLogs} />
      </TabsContent>

      {/* ── Body metrics ──────────────────────────────────────────────────── */}
      <TabsContent value="metrics" className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={handleCreateBodyMetric} className="rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Add body metric</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Log the latest measurement for this client.</p>

            {metricError ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {metricError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="metric-date">Recorded date</Label>
                <Input
                  id="metric-date"
                  type="date"
                  value={metricForm.recordedAt}
                  onChange={(event) => setMetricForm((current) => ({ ...current, recordedAt: event.target.value }))}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="metric-weight">Weight (kg)</Label>
                  <Input
                    id="metric-weight"
                    value={metricForm.weightKg}
                    onChange={(event) => setMetricForm((current) => ({ ...current, weightKg: event.target.value }))}
                    placeholder="72.5"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-bodyfat">Body fat (%)</Label>
                  <Input
                    id="metric-bodyfat"
                    value={metricForm.bodyFatPct}
                    onChange={(event) => setMetricForm((current) => ({ ...current, bodyFatPct: event.target.value }))}
                    placeholder="18"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-waist">Waist (cm)</Label>
                  <Input
                    id="metric-waist"
                    value={metricForm.waistCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, waistCm: event.target.value }))}
                    placeholder="82"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-chest">Chest (cm)</Label>
                  <Input
                    id="metric-chest"
                    value={metricForm.chestCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, chestCm: event.target.value }))}
                    placeholder="98"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-hips">Hips (cm)</Label>
                  <Input
                    id="metric-hips"
                    value={metricForm.hipsCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, hipsCm: event.target.value }))}
                    placeholder="96"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-thigh">Thigh (cm)</Label>
                  <Input
                    id="metric-thigh"
                    value={metricForm.thighCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, thighCm: event.target.value }))}
                    placeholder="54"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="metric-note">Note</Label>
                <Textarea
                  id="metric-note"
                  value={metricForm.note}
                  onChange={(event) => setMetricForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Any context about the measurement or changes since last week..."
                  className="mt-1.5 min-h-[96px]"
                />
              </div>

              <Button type="submit" disabled={isSavingMetric} className="w-full">
                {isSavingMetric ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save body metric
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Weight</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatNumber(latestMetric?.weightKg, " kg")}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Body fat</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatNumber(latestMetric?.bodyFatPct, "%")}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Waist</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatNumber(latestMetric?.waistCm, " cm")}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-5">
              <h2 className="text-base font-semibold">Measurement history</h2>
              <p className="mt-1 text-sm text-muted-foreground">Newest entries appear first.</p>

              {detail.bodyMetrics.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No body metrics recorded for this client yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.bodyMetrics.map((entry: BodyMetricEntry) => (
                    <div key={entry.id} className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{entry.recordedAt.toLocaleDateString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.coachName ? `Logged by ${entry.coachName}` : "Coach entry"}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Weight</p>
                            <p className="font-mono font-medium tabular-nums">{formatNumber(entry.weightKg, " kg")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Body fat</p>
                            <p className="font-mono font-medium tabular-nums">{formatNumber(entry.bodyFatPct, "%")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Waist</p>
                            <p className="font-mono font-medium tabular-nums">{formatNumber(entry.waistCm, " cm")}</p>
                          </div>
                        </div>
                      </div>
                      {entry.note ? <p className="mt-3 text-sm text-muted-foreground">{entry.note}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Check-ins ─────────────────────────────────────────────────────── */}
      <TabsContent value="checkins" className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={handleCreateCheckIn} className="rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">New check-in</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Record adherence, recovery, and coach feedback.</p>

            {checkInError ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {checkInError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="checkin-date">Check-in date</Label>
                <Input
                  id="checkin-date"
                  type="date"
                  value={checkInForm.checkInDate}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, checkInDate: event.target.value }))}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="score-adherence">Adherence (1-10)</Label>
                  <Input
                    id="score-adherence"
                    value={checkInForm.adherenceScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, adherenceScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="score-energy">Energy (1-10)</Label>
                  <Input
                    id="score-energy"
                    value={checkInForm.energyScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, energyScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="score-recovery">Recovery (1-10)</Label>
                  <Input
                    id="score-recovery"
                    value={checkInForm.recoveryScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, recoveryScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="score-mood">Mood (1-10)</Label>
                  <Input
                    id="score-mood"
                    value={checkInForm.moodScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, moodScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="checkin-summary">Summary</Label>
                <Textarea
                  id="checkin-summary"
                  value={checkInForm.summary}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Short recap of the week, current condition, and constraints..."
                  className="mt-1.5 min-h-[96px]"
                />
              </div>

              <div>
                <Label htmlFor="checkin-feedback">Coach feedback</Label>
                <Textarea
                  id="checkin-feedback"
                  value={checkInForm.feedback}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, feedback: event.target.value }))}
                  placeholder="What should the client keep, change, or focus on next?"
                  className="mt-1.5 min-h-[120px]"
                />
              </div>

              <div>
                <Label htmlFor="checkin-focus">Next focus</Label>
                <Input
                  id="checkin-focus"
                  value={checkInForm.nextFocus}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, nextFocus: event.target.value }))}
                  placeholder="Example: keep calories consistent and push squat depth"
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" disabled={isSavingCheckIn} className="w-full">
                {isSavingCheckIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save check-in
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-border p-5">
            <h2 className="text-base font-semibold">Check-in history</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review feedback history and current trend.</p>

            {detail.checkIns.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No check-ins recorded for this client yet.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {detail.checkIns.map((checkIn) => (
                  <div key={checkIn.id} className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{checkIn.checkInDate.toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">Coach: {checkIn.coachName}</p>
                      </div>
                      <Badge variant="micro" className="self-start">
                        Avg {averageScore(checkIn) ?? "--"}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {(
                        [
                          ["Adherence", checkIn.adherenceScore],
                          ["Energy", checkIn.energyScore],
                          ["Recovery", checkIn.recoveryScore],
                          ["Mood", checkIn.moodScore],
                        ] as [string, number | undefined][]
                      ).map(([label, val]) => (
                        <div key={label} className="rounded-md bg-muted/40 px-3 py-2">
                          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                            {formatNumber(val)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {checkIn.summary ? (
                      <div className="mt-4">
                        <p className="text-sm font-medium">Summary</p>
                        <p className="mt-1 text-sm text-muted-foreground">{checkIn.summary}</p>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <p className="text-sm font-medium">Feedback</p>
                      <p className="mt-1 text-sm text-muted-foreground">{checkIn.feedback}</p>
                    </div>

                    {checkIn.nextFocus ? (
                      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
                        <span className="font-medium text-primary">Next focus:</span>{" "}
                        {checkIn.nextFocus}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {/* ── Workout logs ──────────────────────────────────────────────────── */}
      <TabsContent value="logs" className="space-y-6">
        <div className="rounded-lg border border-border p-5">
          <div>
            <h2 className="text-base font-semibold">Workout log history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the full session timeline, inspect logged work, and leave feedback on each completed workout.
            </p>
          </div>

          <div className="mt-6">
            <TraineeWorkoutLogsPanel
              traineeId={detail.trainee.id}
              traineeName={detail.trainee.name}
              initialLogs={detail.recentLogs}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
