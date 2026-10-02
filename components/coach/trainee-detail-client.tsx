"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  ChevronDown,
  ChevronRight,
  Cookie,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  StickyNote,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
} from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { TraineeMealPlanPanel } from "@/components/coach/trainee-meal-plan-panel"
import { TraineeWorkoutLogsPanel } from "@/components/coach/trainee-workout-logs-panel"
import { useCoachData } from "@/lib/queries/coach-data"
import { queryKeys } from "@/lib/queries/keys"
import { fetchCoachTraineeDetail, fetchCoachPrograms } from "@/lib/fitness/api"
import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateKey } from "@/lib/time-zone"
import { cn } from "@/lib/utils"
import {
  useAssignCoachProgram,
  useUnassignCoachProgram,
} from "@/lib/queries/coach"
import type { CoachProgram, CoachTraineeDetail } from "@/lib/fitness/types"
import type { MealType } from "@/lib/types"

/** Same meal order and icons as the trainee meals screen. */
const MEAL_SECTIONS: Array<{ icon: LucideIcon; type: MealType }> = [
  { icon: Sunrise, type: "breakfast" },
  { icon: Sun, type: "lunch" },
  { icon: Sunset, type: "dinner" },
  { icon: Cookie, type: "snack" },
]

type CoachTraineeDetailClientProps = {
  coachPrograms: CoachProgram[]
  initialDetail: CoachTraineeDetail
}

type WorkspaceTab = "overview" | "training" | "nutrition"

function formatNumber(value?: number, suffix = "") {
  return value != null ? `${value}${suffix}` : "--"
}

/* ─── Weekly bar chart (pure CSS, no Recharts) ───────────────────────────── */
type WeekDay = CoachTraineeDetail["overview"]["week"]["days"][number]

/** Overview day keys are UTC, like the backend week and the trainee's schedule. */
function parseDayKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function subscribeToNothing() {
  return () => {}
}

function WeeklyBarChart({ dateLocale, days }: { dateLocale: string; days: WeekDay[] }) {
  const max = Math.max(...days.map((day) => day.sets), 1)
  // The user's today, read in the browser only: a server render has no user zone,
  // so it highlights nothing rather than a day the client would then disagree with.
  const todayKey = useSyncExternalStore(subscribeToNothing, () => formatDateKey(new Date()), () => null)
  const weekdayFormatter = new Intl.DateTimeFormat(dateLocale, { timeZone: "UTC", weekday: "short" })

  return (
    <div className="grid grid-cols-7 items-end gap-2" style={{ height: 84 }}>
      {days.map((day) => {
        const isToday = day.date === todayKey
        const date = parseDayKey(day.date)
        const heightPct = day.sets === 0 ? 4 : Math.max(8, (day.sets / max) * 100)

        return (
          <div key={day.date} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="h-3 font-mono text-micro tabular-nums text-muted-foreground">
              {day.sets > 0 ? day.sets : ""}
            </span>
            <div className="relative flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-sm transition-all",
                  day.sets === 0 ? "bg-border" : isToday ? "bg-primary" : "bg-foreground",
                  todayKey != null && day.date > todayKey && "opacity-40",
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span
              className={cn(
                "flex flex-col items-center font-mono text-micro leading-tight tabular-nums",
                isToday ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              <span className="uppercase">{weekdayFormatter.format(date)}</span>
              <span>{date.getUTCDate()}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Stat card ─────────────────────────────────────────────────────────── */
function StatCard({ hint, label, unit, value }: { hint?: string; label: string; unit?: string; value: string | number }) {
  return (
    <div className="min-h-[88px] rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-md shadow-foreground/5 ring-1 ring-card/70">
      <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 truncate font-mono text-micro text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ─── Recent sessions table ─────────────────────────────────────────────── */
type RecentSession = {
  date: string
  kind: string
  volume: number
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
      <div className="hidden grid-cols-[80px_1fr_100px_80px] gap-3 border-b border-border bg-muted/30 px-4 py-2 sm:grid">
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionDateCol}</span>
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionTypeCol}</span>
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionVolumeCol}</span>
        <span className="font-mono text-micro uppercase tracking-[0.1em] text-muted-foreground">{messages.coach.sessionDoneCol}</span>
      </div>
      {sessions.map((s, i) => (
        <div
          key={i}
          className={cn(
            "grid gap-2 px-4 py-3 sm:grid-cols-[80px_1fr_100px_80px] sm:items-center sm:gap-3",
            i < sessions.length - 1 && "border-b border-border",
          )}
        >
          <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {s.date}
          </span>
          <div className="text-sm font-medium text-foreground">{s.kind}</div>
          <div className="flex flex-wrap gap-2 sm:contents">
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs tabular-nums text-foreground sm:rounded-none sm:bg-transparent sm:p-0 sm:text-sm">
              {(s.volume / 1000).toFixed(1)}k kg
            </span>
            <span
              className={cn(
                "rounded-full bg-muted px-2.5 py-1 font-mono text-xs tabular-nums sm:rounded-none sm:bg-transparent sm:p-0 sm:text-sm",
                s.complete >= 1 ? "text-success-text" : "text-warning-text",
              )}
            >
              {Math.round(s.complete * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */
export function CoachTraineeDetailClient({
  coachPrograms: initialCoachPrograms,
  initialDetail,
}: CoachTraineeDetailClientProps) {
  const { data: coachPrograms = initialCoachPrograms } = useCoachData(queryKeys.coach.programs(), fetchCoachPrograms, initialCoachPrograms)
  const { locale, messages } = useLocale()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    requestedTab === "training" || requestedTab === "nutrition" ? requestedTab : "overview",
  )
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const integerFormatter = new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 0 })
  const assignProgram = useAssignCoachProgram()
  const unassignProgram = useUnassignCoachProgram()
  const detailQuery = useCoachData(queryKeys.coach.traineeDetail(initialDetail.trainee.id), (token) => fetchCoachTraineeDetail(token, initialDetail.trainee.id), initialDetail, true, 30_000)
  const { data: detail = initialDetail, setData: setDetail } = detailQuery
  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignNotice, setAssignNotice] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingProgramId, setRemovingProgramId] = useState<string | null>(null)
  const [expandedNutritionDate, setExpandedNutritionDate] = useState<string | null>(null)

  const assignedProgramIds = new Set(detail.programs.map((program) => program.id))
  const assignablePrograms = coachPrograms.filter((program) => !assignedProgramIds.has(program.id))
  // Every overview number is computed by the backend from the trainee's own logs
  // and schedule, so the coach sees what the trainee sees.
  const { overview } = detail
  const { body, week } = overview
  const dayKeyFormatter = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", timeZone: "UTC" })
  const formatDayKey = (dateKey: string) => dayKeyFormatter.format(parseDayKey(dateKey))
  const weightDelta = body.weightKg?.deltaKg
  const weightHint = body.weightKg
    ? [
        weightDelta != null ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg` : null,
        messages.coach.recordedOn(formatDayKey(body.weightKg.recordedAt)),
      ].filter(Boolean).join(" · ")
    : messages.coach.notRecorded

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
      complete: totalSets > 0 ? completedSets / totalSets : 1,
    }
  })

  // Latest coach note from most recent check-in feedback
  const latestCheckIn = detail.checkIns[0] ?? null
  const latestNote = latestCheckIn?.feedback ?? null
  const planAdherence = week.plannedSessions > 0
    ? Math.round((week.completedSessions / week.plannedSessions) * 100)
    : 0
  const sortedBodyMetrics = [...detail.bodyMetrics].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )

  async function handleAssignProgram() {
    if (!selectedProgramId) {
      return
    }

    setIsAssigning(true)
    setAssignError(null)
    setAssignNotice(null)

    try {
      await assignProgram.mutateAsync({ programId: selectedProgramId, traineeId: detail.trainee.id })
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

  async function handleUnassignProgram(programId: string) {

    setRemovingProgramId(programId)
    setAssignError(null)
    setAssignNotice(null)

    try {
      await unassignProgram.mutateAsync({ programId, traineeId: detail.trainee.id })
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

  const nutritionSummary = detail.nutritionSummary
  const expandedNutritionLog = nutritionSummary?.dailyLogs.find((row) => row.date === expandedNutritionDate) ?? null
  const bodyMetricsByDate = new Map<string, CoachTraineeDetail["bodyMetrics"][number]>()
  for (const entry of detail.bodyMetrics) {
    const dateKey = formatDateKey(entry.recordedAt)
    if (!bodyMetricsByDate.has(dateKey)) {
      bodyMetricsByDate.set(dateKey, entry)
    }
  }
  const mealTypeLabels: Record<MealType, string> = {
    breakfast: messages.meals.breakfast,
    dinner: messages.meals.dinner,
    lunch: messages.meals.lunch,
    snack: messages.meals.snack,
  }

  function handleTabChange(value: string) {
    const nextTab: WorkspaceTab =
      value === "training" || value === "nutrition" ? value : "overview"

    setActiveTab(nextTab)

    const params = new URLSearchParams(window.location.search)
    if (nextTab === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", nextTab)
    }

    const query = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl border border-border/80 bg-card p-1.5 shadow-md shadow-foreground/5 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <TabsList
          data-tour="coach-client-tabs"
          className={cn(
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-transparent p-0",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
        {[
          ["overview", messages.coach.tabOverview],
          ["training", messages.coach.tabTraining],
          ["nutrition", messages.coach.tabNutritionBody],
        ].map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className={cn(
              "flex-none rounded-xl border border-transparent bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors",
              "hover:text-foreground",
              "data-[state=active]:border-primary/25 data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20",
            )}
          >
            {label}
          </TabsTrigger>
        ))}
        </TabsList>
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            hint={week.plannedSessions > 0 ? messages.coach.complianceSessions(week.completedSessions, week.plannedSessions) : messages.coach.statusRestWeek}
            label={messages.coach.completion}
            unit="%"
            value={planAdherence}
          />
          <StatCard
            hint={messages.coach.weekTotals(week.totalSets, integerFormatter.format(week.totalVolume))}
            label={messages.coach.sessionsThisWeek}
            value={week.completedSessions}
          />
          <StatCard
            hint={latestCheckIn?.feedback || messages.coach.noCheckIns}
            label={messages.coach.checkInDateLabel}
            value={latestCheckIn ? latestCheckIn.checkInDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) : "--"}
          />
          <StatCard
            hint={latestCheckIn ? messages.coach.avgScoreLabel(latestCheckIn.recoveryScore ?? "--") : messages.coach.notRecorded}
            label={messages.coach.recoveryScoreLabel}
            unit={latestCheckIn?.recoveryScore != null ? "/10" : undefined}
            value={latestCheckIn?.recoveryScore ?? "--"}
          />
        </div>
        {/* Coach note */}
        {latestNote && (
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-primary-soft/50 px-4 py-3">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-foreground">{latestNote}</p>
          </div>
        )}

        {/* Compact snapshot: week, consistency, and body metrics */}
        <div className="space-y-4">
          <div className="flex min-h-[220px] flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-lg shadow-foreground/5 ring-1 ring-card/80">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                  {messages.coach.thisWeekRange(formatDayKey(week.days[0].date), formatDayKey(week.days[week.days.length - 1].date))}
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
                  {messages.coach.complianceSessions(week.completedSessions, week.plannedSessions)}
                </p>
              </div>
              <span className="rounded-full border border-primary/15 bg-primary-soft/60 px-3 py-1.5 font-mono text-xs tabular-nums text-primary">
                {messages.coach.weekTotals(week.totalSets, integerFormatter.format(week.totalVolume))}
              </span>
            </div>
            <div className="mt-auto">
              <WeeklyBarChart dateLocale={dateLocale} days={week.days} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <StatCard label={messages.coach.progress30DaySessionsLabel} value={overview.last30Days.sessions} />
            <StatCard label={messages.coach.progress30DayVolumeLabel} unit="kg" value={integerFormatter.format(overview.last30Days.volume)} />
            <StatCard
              hint={messages.coach.bestStreak(overview.streaks.bestDays)}
              label={messages.coach.streakLabel}
              value={messages.coach.streakValue(overview.streaks.currentDays)}
            />
            <StatCard
              label={messages.coach.lastWorkoutLabel}
              value={overview.lastWorkoutAt ? formatDayKey(overview.lastWorkoutAt) : messages.coach.noWorkoutsYet}
            />
            <StatCard
              hint={weightHint}
              label={messages.coach.weightStatLabel}
              unit={body.weightKg ? "kg" : undefined}
              value={body.weightKg?.value ?? "--"}
            />
            <StatCard
              hint={body.bodyFatPct ? messages.coach.recordedOn(formatDayKey(body.bodyFatPct.recordedAt)) : messages.coach.notRecorded}
              label={messages.coach.bodyFatStatLabel}
              unit={body.bodyFatPct ? "%" : undefined}
              value={body.bodyFatPct?.value ?? "--"}
            />
            <StatCard
              hint={body.waistCm ? messages.coach.recordedOn(formatDayKey(body.waistCm.recordedAt)) : messages.coach.notRecorded}
              label={messages.coach.waistStatLabel}
              unit={body.waistCm ? "cm" : undefined}
              value={body.waistCm?.value ?? "--"}
            />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Personal records */}
          {overview.recentPRs.length > 0 ? (
            <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70">
              <p className="mb-2 font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                {messages.coach.recentPRsTitle}
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                {overview.recentPRs.map((pr, index) => (
                  <div
                    key={`${pr.exerciseName}-${pr.date}`}
                    className={cn("flex items-center justify-between gap-3 px-3 py-2.5", index > 0 && "border-t border-border")}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{pr.exerciseName}</p>
                      <p className="font-mono text-micro text-muted-foreground">{formatDayKey(pr.date)}</p>
                    </div>
                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <p className="text-sm text-foreground">{pr.weightKg} kg</p>
                      <p className="text-micro text-success-text">{messages.coach.prDelta(pr.deltaKg)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Recent sessions */}
          <section className={cn("rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70", overview.recentPRs.length === 0 && "xl:col-span-2")}>
            <p className="mb-2 font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
              {messages.coach.recentSessions}
            </p>
            <RecentSessionsTable sessions={recentSessions} />
          </section>
        </div>

      </TabsContent>

      {/* ── Nutrition ─────────────────────────────────────────────────────── */}
      <TabsContent value="nutrition" className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
        <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
          <div className="min-w-0 space-y-4">
            <TraineeMealPlanPanel traineeId={detail.trainee.id} />

            <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70">
              <h2 className="text-base font-semibold">{messages.coach.nutritionTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.coach.nutritionDesc}
              </p>

              {!nutritionSummary ? (
                <p className="mt-4 text-sm text-muted-foreground">{messages.coach.nutritionUnavailable}</p>
              ) : nutritionSummary.daysTracked === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{messages.coach.noMealsLogged30Days}</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
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
                    <div key={card.label} className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
                      <p className="label-micro text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-base font-semibold tnum">{card.value}</p>
                      {card.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.sub}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="min-w-0 max-w-full rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{messages.coach.nutritionTitle} · 30 ngày</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nutritionSummary ? messages.coach.daysTrackedLabel(nutritionSummary.daysTracked) : messages.coach.nutritionDesc}
                </p>
              </div>
            </div>

            {!nutritionSummary ? (
              <p className="mt-4 text-sm text-muted-foreground">{messages.coach.nutritionUnavailable}</p>
            ) : nutritionSummary.daysTracked === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{messages.coach.noMealsLogged30Days}</p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:hidden">
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
                  <div key={card.label} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="label-micro text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-sm font-semibold tnum">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Daily log accordion — tap a day to expand meal-by-meal breakdown */}
              <div className="mt-4 flex min-w-0 max-w-full max-h-[520px] flex-col gap-2 overflow-x-hidden overflow-y-auto pr-1">
                {nutritionSummary.dailyLogs.map((row) => {
                  const goal = nutritionSummary.traineeCalorieGoal
                  const goalPct = goal > 0 ? Math.round((row.calories / goal) * 100) : null
                  const over = goal > 0 && row.calories > goal
                  const onTrack = goalPct != null && goalPct >= 90 && goalPct <= 110
                  const isOpen = expandedNutritionDate === row.date
                  const bodyMetric = bodyMetricsByDate.get(row.date)
                  return (
                    // shrink-0: in a height-capped flex column, overflow-hidden rows
                    // would otherwise be squashed to fit instead of the list scrolling.
                    <div
                      key={row.date}
                      className="shrink-0 overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedNutritionDate(isOpen ? null : row.date)}
                        className="flex min-w-0 w-full max-w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 sm:gap-3"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {/* dd/MM on one line: the list only spans the last 30 days. */}
                        <span
                          title={row.date}
                          className="shrink-0 whitespace-nowrap font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground"
                        >
                          {`${row.date.slice(8, 10)}/${row.date.slice(5, 7)}`}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate font-mono text-sm tabular-nums",
                            over ? "text-warning-text" : "text-foreground",
                          )}
                        >
                          {integerFormatter.format(row.calories)}{" "}
                          {goal > 0 && (
                            <span className="text-muted-foreground">
                              / {integerFormatter.format(goal)} kcal
                            </span>
                          )}
                        </span>
                        <span className="max-w-[5.5rem] shrink-0 truncate font-mono text-xs tabular-nums text-muted-foreground sm:max-w-none">
                          {bodyMetric?.weightKg != null ? `W ${formatNumber(bodyMetric.weightKg, " kg")}` : "W --"}
                          {bodyMetric?.bodyFatPct != null ? ` · BF ${formatNumber(bodyMetric.bodyFatPct, "%")}` : ""}
                        </span>
                        <span className="hidden font-mono text-xs tabular-nums text-muted-foreground md:inline">
                          P {Math.round(row.protein)}g
                        </span>
                        {goal > 0 && (
                          <Badge
                            variant="micro"
                            className={cn(
                              "shrink-0",
                              over
                                ? "border-warning/20 bg-warning-soft text-warning-text"
                                : onTrack
                                  ? "border-success/20 bg-success/10 text-success-text"
                                  : "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {over ? "Over" : messages.coach.statusOnTrack}
                          </Badge>
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-border">
                          {/* Day macro totals */}
                          <div className="grid grid-cols-3 gap-3 border-b border-border bg-muted/20 px-4 py-3">
                            {(
                              [
                                [messages.coach.proteinCol, row.protein],
                                [messages.coach.carbsCol, row.carbs],
                                [messages.coach.fatCol, row.fat],
                              ] as [string, number][]
                            ).map(([label, value]) => (
                              <div key={label}>
                                <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                                  {label}
                                </p>
                                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                                  {Math.round(value)}g
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Meal sections */}
                          {MEAL_SECTIONS.map(({ icon: Icon, type }) => {
                            const items = row.items.filter((item) => item.mealType === type)
                            if (items.length === 0) return null
                            const mealCalories = items.reduce((sum, item) => sum + item.calories, 0)
                            return (
                              <div key={type} className="border-t border-border/50 first:border-t-0">
                                <div className="flex items-center gap-2.5 bg-muted/10 px-4 py-2 pl-11">
                                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                                    {mealTypeLabels[type]}
                                  </span>
                                  <span className="font-mono text-micro tabular-nums text-muted-foreground">
                                    {Math.round(mealCalories)} kcal
                                  </span>
                                </div>
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-3 border-t border-border/40 px-4 py-2 pl-11"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-foreground">
                                        {item.name}
                                        {item.amountLabel ? (
                                          <span className="text-muted-foreground"> {item.amountLabel}</span>
                                        ) : null}
                                      </p>
                                      <p className="mt-0.5 font-mono text-micro tabular-nums text-muted-foreground">
                                        P{Math.round(item.protein ?? 0)} · C{Math.round(item.carbs ?? 0)} · F{Math.round(item.fat ?? 0)}
                                      </p>
                                    </div>
                                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                      {Math.round(item.calories)} kcal
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              </>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{messages.coach.measurementHistory}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{messages.coach.measurementHistoryDesc}</p>
            </div>
            {sortedBodyMetrics[0] ? (
              <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                {sortedBodyMetrics[0].recordedAt.toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            ) : null}
          </div>

          {sortedBodyMetrics.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {messages.coach.noBodyMetrics}
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [messages.coach.weightKgLabel, sortedBodyMetrics[0].weightKg, "kg"],
                  [messages.coach.bodyFatPctLabel, sortedBodyMetrics[0].bodyFatPct, "%"],
                  [messages.coach.waistCmLabel, sortedBodyMetrics[0].waistCm, "cm"],
                  [messages.coach.chestCmLabel, sortedBodyMetrics[0].chestCm, "cm"],
                  [messages.coach.hipsCmLabel, sortedBodyMetrics[0].hipsCm, "cm"],
                  [messages.coach.thighCmLabel, sortedBodyMetrics[0].thighCm, "cm"],
                ].map(([label, value, unit]) => (
                  <div key={String(label)} className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                    <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                      {typeof value === "number" ? `${value} ${unit}` : "--"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                {sortedBodyMetrics.slice(0, 8).map((entry, index) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "grid gap-2 px-3 py-3 sm:grid-cols-[110px_1fr_auto] sm:items-center",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.recordedAt.toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="text-sm text-foreground">
                      {[
                        entry.weightKg != null ? `${entry.weightKg} kg` : null,
                        entry.bodyFatPct != null ? `${entry.bodyFatPct}% BF` : null,
                        entry.waistCm != null ? `${entry.waistCm} cm waist` : null,
                      ].filter(Boolean).join(" · ") || messages.coach.notRecorded}
                    </span>
                    <span className="font-mono text-micro text-muted-foreground">
                      {entry.source === "huawei" ? "Huawei" : entry.coachName ?? messages.coach.coachEntry}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </TabsContent>

      {/* ── Training ──────────────────────────────────────────────────────── */}
      <TabsContent value="training" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={messages.coach.progress30DaySessionsLabel} value={overview.last30Days.sessions} />
          <StatCard label={messages.coach.progress30DayVolumeLabel} unit="kg" value={integerFormatter.format(overview.last30Days.volume)} />
          <StatCard
            hint={messages.coach.bestStreak(overview.streaks.bestDays)}
            label={messages.coach.streakLabel}
            value={messages.coach.streakValue(overview.streaks.currentDays)}
          />
          <StatCard
            label={messages.coach.recentPRsTitle}
            value={overview.recentPRs.length}
          />
        </div>

        {/* Assigned programs */}
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-md shadow-foreground/5 ring-1 ring-card/70" data-tour="coach-client-actions">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">{messages.coach.assignedProgramsTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.coach.assignedProgramsDesc}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-full min-w-[240px] rounded-xl bg-background/70">
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
                className="rounded-xl"
                onClick={() => void handleAssignProgram()}
                disabled={!selectedProgramId || isAssigning}
              >
                {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {messages.coach.assignProgram}
              </Button>
            </div>
          </div>

          {assignError ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">
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
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{program.name}</p>
                      {program.forkedFromProgramId ? (
                        <Badge variant="micro" className="border-primary/20 bg-primary-soft text-primary">
                          {locale === "en" ? "Personalized copy" : "Bản cá nhân hoá"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {program.workoutsPerWeek} workouts/week · {program.duration} weeks · {program.difficulty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/coach/programs/${program.id}?adjustTrainee=${detail.trainee.id}`} className="flex-1 sm:flex-none">
                      <Button className="w-full">
                        {messages.coach.adjustPlan}
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 bg-transparent"
                          disabled={removingProgramId === program.id}
                        >
                          {removingProgramId === program.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/coach/programs/${program.id}`}>
                            <ExternalLink />
                            {messages.coach.openPlan}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void handleUnassignProgram(program.id)}
                        >
                          <Trash2 />
                          {messages.coach.removeProgram}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-md shadow-foreground/5 ring-1 ring-card/70">
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
        </section>
      </TabsContent>
      <Dialog open={Boolean(expandedNutritionLog)} onOpenChange={(open) => !open && setExpandedNutritionDate(null)}>
        <DialogContent className="max-h-[86dvh] max-w-[min(94vw,560px)] overflow-hidden p-0">
          {expandedNutritionLog ? (
            <>
              <DialogHeader className="border-b border-border px-4 py-4 text-left">
                <DialogTitle>{formatDayKey(expandedNutritionLog.date)}</DialogTitle>
                <DialogDescription>
                  {integerFormatter.format(expandedNutritionLog.calories)} kcal
                  {bodyMetricsByDate.get(expandedNutritionLog.date)?.weightKg != null
                    ? ` · ${formatNumber(bodyMetricsByDate.get(expandedNutritionLog.date)?.weightKg, " kg")}`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(86dvh-92px)] overflow-y-auto px-4 py-4">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      [messages.coach.proteinCol, expandedNutritionLog.protein],
                      [messages.coach.carbsCol, expandedNutritionLog.carbs],
                      [messages.coach.fatCol, expandedNutritionLog.fat],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                      <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{Math.round(value)}g</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {MEAL_SECTIONS.map(({ icon: Icon, type }) => {
                    const items = expandedNutritionLog.items.filter((item) => item.mealType === type)
                    if (items.length === 0) return null
                    const mealCalories = items.reduce((sum, item) => sum + item.calories, 0)
                    return (
                      <section key={type} className="overflow-hidden rounded-lg border border-border">
                        <div className="flex items-center gap-2.5 bg-muted/20 px-3 py-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{mealTypeLabels[type]}</span>
                          <span className="font-mono text-micro tabular-nums text-muted-foreground">{Math.round(mealCalories)} kcal</span>
                        </div>
                        {items.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 border-t border-border/40 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground">
                                {item.name}
                                {item.amountLabel ? <span className="text-muted-foreground"> {item.amountLabel}</span> : null}
                              </p>
                              <p className="mt-0.5 font-mono text-micro tabular-nums text-muted-foreground">
                                P{Math.round(item.protein ?? 0)} · C{Math.round(item.carbs ?? 0)} · F{Math.round(item.fat ?? 0)}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{Math.round(item.calories)} kcal</span>
                          </div>
                        ))}
                      </section>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
