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
import { useLocale } from "@/components/providers/locale-provider"
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
  exportCoachWorkoutLogsToGoogleSheets,
  fetchCoachWorkoutLogs,
  unassignCoachProgram,
} from "@/lib/fitness/api"
import { formatDateToISO, getProgramStartDate } from "@/lib/fitness/date-range"
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

function getProgramExportStartDate(program: CoachProgram, assignedAt: unknown) {
  return formatDateToISO(getProgramStartDate(assignedAt, program.duration))
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
          <Badge variant="micro" className="bg-primary-soft text-primary border-primary/20">
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
  const { messages } = useLocale()

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        {messages.coach.noSessionsYet}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_100px_80px_32px] gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionDateCol}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionTypeCol}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionVolumeCol}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionDoneCol}</span>
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
            {s.kind}
            {s.prs > 0 && (
              <Badge variant="micro" className="bg-primary-soft text-primary border-primary/20">
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
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const [detail, setDetail] = useState(initialDetail)
  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [metricForm, setMetricForm] = useState<BodyMetricFormState>(createDefaultMetricForm)
  const [checkInForm, setCheckInForm] = useState<CheckInFormState>(createDefaultCheckInForm)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignNotice, setAssignNotice] = useState<string | null>(null)
  const [metricError, setMetricError] = useState<string | null>(null)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingProgramId, setRemovingProgramId] = useState<string | null>(null)
  const [exportingProgramId, setExportingProgramId] = useState<string | null>(null)
  const [exportingSheetsProgramId, setExportingSheetsProgramId] = useState<string | null>(null)
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
        dateLocale,
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
    setAssignNotice(null)

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
    setAssignNotice(null)

    try {
      const assignment = program.assignedTrainees.find((t) => t.id === detail.trainee.id)
      const from = getProgramExportStartDate(program, assignment?.assignedAt)

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
        const result = await fetchCoachWorkoutLogs(session.access_token, detail.trainee.id, {
          cursor,
          from,
          limit: 50,
          programId: program.id,
          to,
        })
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

  async function handleExportProgramLogsToGoogleSheets(program: CoachProgram) {
    if (!session?.access_token) return
    setExportingSheetsProgramId(program.id)
    setAssignError(null)
    setAssignNotice(null)

    try {
      const assignment = program.assignedTrainees.find((t) => t.id === detail.trainee.id)
      const from = getProgramExportStartDate(program, assignment?.assignedAt)
      const endDate = new Date(from)
      endDate.setDate(endDate.getDate() + program.duration * 7)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const toDate = endDate < tomorrow ? endDate : tomorrow
      const to = toDate.toISOString().slice(0, 10)

      await exportCoachWorkoutLogsToGoogleSheets(session.access_token, detail.trainee.id, {
        from,
        label: program.name,
        programId: program.id,
        to,
      })
      setAssignNotice(`Exported ${program.name} workout logs to Google Sheets.`)
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Không thể export logs sang Google Sheets.")
    } finally {
      setExportingSheetsProgramId(null)
    }
  }

  async function handleUnassignProgram(programId: string) {
    if (!session?.access_token) {
      return
    }

    setRemovingProgramId(programId)
    setAssignError(null)
    setAssignNotice(null)

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

  const nutritionSummary = detail.nutritionSummary

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-6 bg-muted/50">
        <TabsTrigger value="overview">{messages.coach.tabOverview}</TabsTrigger>
        <TabsTrigger value="progress">{messages.coach.tabProgress}</TabsTrigger>
        <TabsTrigger value="metrics">{messages.coach.tabBodyMetrics}</TabsTrigger>
        <TabsTrigger value="checkins">{messages.coach.tabCheckIns}</TabsTrigger>
        <TabsTrigger value="nutrition">{messages.coach.tabNutrition}</TabsTrigger>
        <TabsTrigger value="logs">{messages.coach.tabWorkoutLogs}</TabsTrigger>
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
                {messages.coach.thisWeekSetsPerDay}
              </p>
              <p className="mt-1.5 font-mono text-[22px] font-medium tabular-nums text-foreground">
                {weeklyData.reduce((a, b) => a + b, 0)}{" "}
                <span className="text-sm font-normal text-muted-foreground">{messages.coach.sets}</span>
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {messages.coach.complianceSessions(detail.trainee.thisWeekWorkouts, plannedSessionsPerWeek || 0)}
            </span>
          </div>
          <WeeklyBarChart data={weeklyData} />
        </div>

        {/* Key lifts */}
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {messages.coach.keyMetrics}
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
            {messages.coach.recentSessions}
          </p>
          <RecentSessionsTable sessions={recentSessions} />
        </div>

        {/* Assigned programs */}
        <div className="rounded-lg border border-border p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">{messages.coach.assignedProgramsTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.coach.assignedProgramsDesc}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-full min-w-[240px]">
                  <SelectValue placeholder={messages.coach.selectProgramPlaceholder} />
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
                {messages.coach.assignProgram}
              </Button>
            </div>
          </div>

          {assignError ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
              {assignError}
            </div>
          ) : null}
          {assignNotice ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
              {assignNotice}
            </div>
          ) : null}

          {detail.programs.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {messages.coach.noProgramsAssigned}
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
                      disabled={exportingProgramId === program.id || exportingSheetsProgramId === program.id}
                    >
                      {exportingProgramId === program.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Download className="mr-2 h-4 w-4" />}
                      {messages.coach.exportLogs}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent sm:w-auto"
                      onClick={() => void handleExportProgramLogsToGoogleSheets(program)}
                      disabled={exportingProgramId === program.id || exportingSheetsProgramId === program.id}
                    >
                      {exportingSheetsProgramId === program.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Download className="mr-2 h-4 w-4" />}
                      Google Sheets
                    </Button>
                    <Link href={`/coach/programs/${program.id}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full bg-transparent">
                        {messages.coach.openPlan}
                      </Button>
                    </Link>
                    <Link href={`/coach/programs/${program.id}?adjustTrainee=${detail.trainee.id}`} className="w-full sm:w-auto">
                      <Button className="w-full">
                        {messages.coach.adjustPlan}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive-soft hover:text-destructive"
                      onClick={() => void handleUnassignProgram(program.id)}
                      disabled={removingProgramId === program.id}
                    >
                      {removingProgramId === program.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      {messages.coach.removeProgram}
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
              <span className="font-mono text-xs uppercase tracking-[0.08em]">{messages.coach.progressLast7DaysLabel}</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {detail.progressSummary.workoutsLast7Days}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.progressWorkoutsLast7DaysDesc}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">{messages.coach.progress30DayVolumeLabel}</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {Math.round(detail.progressSummary.totalVolumeLast30Days).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.progressTotalVolumeDesc}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">{messages.coach.progress30DaySessionsLabel}</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {detail.progressSummary.workoutsLast30Days}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.progressCompletedSessions}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-mono text-xs uppercase tracking-[0.08em]">{messages.coach.progressLatestWorkoutLabel}</span>
            </div>
            <p className="mt-3 font-mono text-lg font-semibold">
              {detail.progressSummary.latestWorkoutAt
                ? detail.progressSummary.latestWorkoutAt.toLocaleDateString(dateLocale)
                : "--"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.progressMostRecentDesc}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{messages.coach.weeklyCompliance}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.coach.weeklyComplianceDesc}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold tabular-nums">{completionRate}%</p>
              <p className="font-mono text-xs text-muted-foreground">
                {messages.coach.complianceSessions(detail.trainee.thisWeekWorkouts, plannedSessionsPerWeek || 0)}
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
              <h2 className="text-base font-semibold">{messages.coach.addBodyMetricTitle}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.addBodyMetricDesc}</p>

            {metricError ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                {metricError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="metric-date">{messages.coach.recordedDateLabel}</Label>
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
                  <Label htmlFor="metric-weight">{messages.coach.weightKgLabel}</Label>
                  <Input
                    id="metric-weight"
                    value={metricForm.weightKg}
                    onChange={(event) => setMetricForm((current) => ({ ...current, weightKg: event.target.value }))}
                    placeholder="72.5"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-bodyfat">{messages.coach.bodyFatPctLabel}</Label>
                  <Input
                    id="metric-bodyfat"
                    value={metricForm.bodyFatPct}
                    onChange={(event) => setMetricForm((current) => ({ ...current, bodyFatPct: event.target.value }))}
                    placeholder="18"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-waist">{messages.coach.waistCmLabel}</Label>
                  <Input
                    id="metric-waist"
                    value={metricForm.waistCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, waistCm: event.target.value }))}
                    placeholder="82"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-chest">{messages.coach.chestCmLabel}</Label>
                  <Input
                    id="metric-chest"
                    value={metricForm.chestCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, chestCm: event.target.value }))}
                    placeholder="98"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-hips">{messages.coach.hipsCmLabel}</Label>
                  <Input
                    id="metric-hips"
                    value={metricForm.hipsCm}
                    onChange={(event) => setMetricForm((current) => ({ ...current, hipsCm: event.target.value }))}
                    placeholder="96"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="metric-thigh">{messages.coach.thighCmLabel}</Label>
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
                <Label htmlFor="metric-note">{messages.coach.metricNoteLabel}</Label>
                <Textarea
                  id="metric-note"
                  value={metricForm.note}
                  onChange={(event) => setMetricForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder={messages.coach.metricNotePlaceholder}
                  className="mt-1.5 min-h-[96px]"
                />
              </div>

              <Button type="submit" disabled={isSavingMetric} className="w-full">
                {isSavingMetric ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {messages.coach.saveBodyMetric}
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{messages.coach.weightStatLabel}</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatNumber(latestMetric?.weightKg, " kg")}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{messages.coach.bodyFatStatLabel}</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatNumber(latestMetric?.bodyFatPct, "%")}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{messages.coach.waistStatLabel}</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{formatNumber(latestMetric?.waistCm, " cm")}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-5">
              <h2 className="text-base font-semibold">{messages.coach.measurementHistory}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{messages.coach.measurementHistoryDesc}</p>

              {detail.bodyMetrics.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  {messages.coach.noBodyMetrics}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.bodyMetrics.map((entry: BodyMetricEntry) => (
                    <div key={entry.id} className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{entry.recordedAt.toLocaleDateString(dateLocale)}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.coachName ? messages.coach.loggedBy(entry.coachName) : messages.coach.coachEntry}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">{messages.coach.weightStatLabel}</p>
                            <p className="font-mono font-medium tabular-nums">{formatNumber(entry.weightKg, " kg")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{messages.coach.bodyFatStatLabel}</p>
                            <p className="font-mono font-medium tabular-nums">{formatNumber(entry.bodyFatPct, "%")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{messages.coach.waistStatLabel}</p>
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
              <h2 className="text-base font-semibold">{messages.coach.newCheckInTitle}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.newCheckInDesc}</p>

            {checkInError ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                {checkInError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="checkin-date">{messages.coach.checkInDateLabel}</Label>
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
                  <Label htmlFor="score-adherence">{messages.coach.adherenceScoreLabel}</Label>
                  <Input
                    id="score-adherence"
                    value={checkInForm.adherenceScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, adherenceScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="score-energy">{messages.coach.energyScoreLabel}</Label>
                  <Input
                    id="score-energy"
                    value={checkInForm.energyScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, energyScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="score-recovery">{messages.coach.recoveryScoreLabel}</Label>
                  <Input
                    id="score-recovery"
                    value={checkInForm.recoveryScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, recoveryScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="score-mood">{messages.coach.moodScoreLabel}</Label>
                  <Input
                    id="score-mood"
                    value={checkInForm.moodScore}
                    onChange={(event) => setCheckInForm((current) => ({ ...current, moodScore: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="checkin-summary">{messages.coach.checkInSummaryLabel}</Label>
                <Textarea
                  id="checkin-summary"
                  value={checkInForm.summary}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder={messages.coach.checkInSummaryPlaceholder}
                  className="mt-1.5 min-h-[96px]"
                />
              </div>

              <div>
                <Label htmlFor="checkin-feedback">{messages.coach.coachFeedbackLabel}</Label>
                <Textarea
                  id="checkin-feedback"
                  value={checkInForm.feedback}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, feedback: event.target.value }))}
                  placeholder={messages.coach.coachFeedbackPlaceholder}
                  className="mt-1.5 min-h-[120px]"
                />
              </div>

              <div>
                <Label htmlFor="checkin-focus">{messages.coach.nextFocusInputLabel}</Label>
                <Input
                  id="checkin-focus"
                  value={checkInForm.nextFocus}
                  onChange={(event) => setCheckInForm((current) => ({ ...current, nextFocus: event.target.value }))}
                  placeholder={messages.coach.nextFocusPlaceholder}
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" disabled={isSavingCheckIn} className="w-full">
                {isSavingCheckIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {messages.coach.saveCheckIn}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-border p-5">
            <h2 className="text-base font-semibold">{messages.coach.checkInHistoryTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{messages.coach.checkInHistoryDesc}</p>

            {detail.checkIns.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {messages.coach.noCheckIns}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {detail.checkIns.map((checkIn) => (
                  <div key={checkIn.id} className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{checkIn.checkInDate.toLocaleDateString(dateLocale)}</p>
                        <p className="text-sm text-muted-foreground">{messages.coach.coachByName(checkIn.coachName)}</p>
                      </div>
                      <Badge variant="micro" className="self-start">
                        {messages.coach.avgScoreLabel(averageScore(checkIn) ?? "--")}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {(
                        [
                          [messages.coach.adherenceStatLabel, checkIn.adherenceScore],
                          [messages.coach.energyStatLabel, checkIn.energyScore],
                          [messages.coach.recoveryStatLabel, checkIn.recoveryScore],
                          [messages.coach.moodStatLabel, checkIn.moodScore],
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
                        <p className="text-sm font-medium">{messages.coach.checkInSummarySection}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{checkIn.summary}</p>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <p className="text-sm font-medium">{messages.coach.checkInFeedbackSection}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{checkIn.feedback}</p>
                    </div>

                    {checkIn.nextFocus ? (
                      <div className="mt-4 rounded-md border border-primary/20 bg-primary-soft px-3 py-3 text-sm">
                        <span className="font-medium text-primary">{messages.coach.nextFocusSection}</span>{" "}
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

      {/* ── Nutrition ─────────────────────────────────────────────────────── */}
      <TabsContent value="nutrition" className="space-y-6">
        <div className="rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">{messages.coach.nutritionTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {messages.coach.nutritionDesc}
          </p>

          {!nutritionSummary ? (
            <p className="mt-6 text-sm text-muted-foreground">{messages.coach.nutritionUnavailable}</p>
          ) : nutritionSummary.daysTracked === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">{messages.coach.noMealsLogged30Days}</p>
          ) : (
            <>
              {/* Summary stat cards */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: messages.coach.avgCaloriesLabel,
                    value: `${nutritionSummary.avgCalories} kcal`,
                    sub: nutritionSummary.traineeCalorieGoal
                      ? messages.coach.calorieGoalLabel(nutritionSummary.traineeCalorieGoal)
                      : undefined,
                  },
                  { label: messages.coach.avgProteinLabel, value: `${nutritionSummary.avgProtein} g` },
                  { label: messages.coach.avgCarbsLabel, value: `${nutritionSummary.avgCarbs} g` },
                  { label: messages.coach.avgFatLabel, value: `${nutritionSummary.avgFat} g` },
                ].map((card) => (
                  <div key={card.label} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="label-micro text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-lg font-semibold tnum">{card.value}</p>
                    {card.sub && <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>}
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {messages.coach.daysTrackedLabel(nutritionSummary.daysTracked)}
              </p>

              {/* Daily log table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-micro pb-2 pr-4 font-medium text-muted-foreground">{messages.coach.nutritionDateCol}</th>
                      <th className="label-micro min-w-[240px] pb-2 pr-4 font-medium text-muted-foreground">{messages.coach.nutritionFoodsCol}</th>
                      <th className="label-micro pb-2 pr-4 text-right font-medium text-muted-foreground">{messages.coach.caloriesCol}</th>
                      <th className="label-micro pb-2 pr-4 text-right font-medium text-muted-foreground">{messages.coach.proteinCol}</th>
                      <th className="label-micro pb-2 pr-4 text-right font-medium text-muted-foreground">{messages.coach.carbsCol}</th>
                      <th className="label-micro pb-2 text-right font-medium text-muted-foreground">{messages.coach.fatCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nutritionSummary.dailyLogs.map((row) => {
                      const goalPct = nutritionSummary.traineeCalorieGoal > 0
                        ? Math.round((row.calories / nutritionSummary.traineeCalorieGoal) * 100)
                        : null
                      return (
                        <tr key={row.date} className="border-b border-border/50 last:border-0">
                          <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-muted-foreground">{row.date}</td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-1.5">
                              {row.items.map((item) => (
                                <span
                                  key={item.id}
                                  className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground"
                                  title={`${item.name}${item.amountLabel ? ` ${item.amountLabel}` : ""}`}
                                >
                                  <span className="truncate">{item.name}</span>
                                  {item.amountLabel ? (
                                    <span className="shrink-0 text-muted-foreground">{item.amountLabel}</span>
                                  ) : null}
                                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground tnum">
                                    {item.calories} kcal
                                  </span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-xs tnum">
                            {row.calories}
                            {goalPct != null && (
                              <span className={cn("ml-1.5 text-[10px]", goalPct >= 90 && goalPct <= 110 ? "text-success" : "text-muted-foreground")}>
                                {goalPct}%
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-xs tnum">{Math.round(row.protein)}g</td>
                          <td className="py-2 pr-4 text-right font-mono text-xs tnum">{Math.round(row.carbs)}g</td>
                          <td className="py-2 text-right font-mono text-xs tnum">{Math.round(row.fat)}g</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </TabsContent>

      {/* ── Workout logs ──────────────────────────────────────────────────── */}
      <TabsContent value="logs" className="space-y-6">
        <div className="rounded-lg border border-border p-5">
          <div>
            <h2 className="text-base font-semibold">{messages.coach.workoutLogHistoryTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.coach.workoutLogHistoryDesc}
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
