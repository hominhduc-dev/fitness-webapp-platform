"use client"

import type React from "react"
import Link from "next/link"
import { BarChart3, ClipboardCheck, Loader2, Scale, Trash2 } from "lucide-react"
import { useState } from "react"

import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TraineeWorkoutLogsPanel } from "@/components/coach/trainee-workout-logs-panel"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  assignCoachProgram,
  createCoachBodyMetric,
  createCoachCheckIn,
  unassignCoachProgram,
} from "@/lib/fitness/api"
import type { BodyMetricEntry, CoachCheckIn, CoachProgram, CoachTraineeDetail } from "@/lib/fitness/types"

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
      setAssignError(error instanceof Error ? error.message : "Không thể gán program.")
    } finally {
      setIsAssigning(false)
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
      setAssignError(error instanceof Error ? error.message : "Không thể gỡ program.")
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
      setMetricError(error instanceof Error ? error.message : "Không thể lưu body metrics.")
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
      setCheckInError(error instanceof Error ? error.message : "Không thể lưu check-in.")
    } finally {
      setIsSavingCheckIn(false)
    }
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5 bg-card">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="metrics">Body Metrics</TabsTrigger>
        <TabsTrigger value="checkins">Check-ins</TabsTrigger>
        <TabsTrigger value="logs">Workout Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Programs</p>
            <p className="mt-2 text-3xl font-bold">{detail.programs.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Assigned to this trainee</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">This Week</p>
            <p className="mt-2 text-3xl font-bold">{detail.trainee.thisWeekWorkouts}</p>
            <p className="mt-1 text-sm text-muted-foreground">Completed workouts</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completion</p>
            <p className="mt-2 text-3xl font-bold">{completionRate}%</p>
            <p className="mt-1 text-sm text-muted-foreground">{plannedSessionsPerWeek} planned sessions/week</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest Weight</p>
            <p className="mt-2 text-3xl font-bold">{formatNumber(latestMetric?.weightKg, " kg")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {latestWeightDelta == null
                ? "Chưa đủ dữ liệu so sánh"
                : `${latestWeightDelta > 0 ? "+" : ""}${latestWeightDelta.toFixed(1)} kg so với lần trước`}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assigned Programs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gán hoặc gỡ chương trình ngay từ hồ sơ học viên.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-full min-w-[240px] bg-muted/20">
                  <SelectValue placeholder="Chọn program để gán" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
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
                className="bg-primary hover:bg-primary/90"
              >
                {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gán program
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
              Học viên này chưa có program nào được gán.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {detail.programs.map((program) => (
                <div
                  key={program.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{program.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {program.workoutsPerWeek} workouts/week • {program.duration} weeks • {program.difficulty}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link href={`/coach/programs/${program.id}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full bg-transparent">
                        Open plan
                      </Button>
                    </Link>
                    <Link href={`/coach/programs/${program.id}?adjustTrainee=${detail.trainee.id}`} className="w-full sm:w-auto">
                      <Button className="w-full bg-primary hover:bg-primary/90">
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
                      Gỡ gán
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <RecentActivity logs={detail.recentLogs} />
      </TabsContent>

      <TabsContent value="progress" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">7-day progress</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{detail.progressSummary.workoutsLast7Days}</p>
            <p className="mt-1 text-sm text-muted-foreground">Workouts in the last 7 days</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">30-day volume</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{Math.round(detail.progressSummary.totalVolumeLast30Days).toLocaleString()}</p>
            <p className="mt-1 text-sm text-muted-foreground">Total logged volume</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">30-day sessions</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{detail.progressSummary.workoutsLast30Days}</p>
            <p className="mt-1 text-sm text-muted-foreground">Completed sessions</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Latest workout</span>
            </div>
            <p className="mt-3 text-lg font-bold">
              {detail.progressSummary.latestWorkoutAt
                ? detail.progressSummary.latestWorkoutAt.toLocaleDateString()
                : "--"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Most recent completed workout</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Weekly Compliance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare completed workouts with the currently assigned weekly plan.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{completionRate}%</p>
              <p className="text-sm text-muted-foreground">{detail.trainee.thisWeekWorkouts}/{plannedSessionsPerWeek || 0} sessions</p>
            </div>
          </div>
          <Progress value={completionRate} className="mt-5 h-3 bg-muted [&_[data-slot=progress-indicator]]:bg-primary" />
        </div>

        <RecentActivity logs={detail.recentLogs} />
      </TabsContent>

      <TabsContent value="metrics" className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={handleCreateBodyMetric} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Add Body Metric</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Log the latest measurement for this trainee.</p>

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

              <Button type="submit" disabled={isSavingMetric} className="w-full bg-primary hover:bg-primary/90">
                {isSavingMetric ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save body metric
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Weight</p>
                <p className="mt-2 text-2xl font-bold">{formatNumber(latestMetric?.weightKg, " kg")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Body Fat</p>
                <p className="mt-2 text-2xl font-bold">{formatNumber(latestMetric?.bodyFatPct, "%")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Waist</p>
                <p className="mt-2 text-2xl font-bold">{formatNumber(latestMetric?.waistCm, " cm")}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Measurement History</h2>
              <p className="mt-1 text-sm text-muted-foreground">Newest entries appear first.</p>

              {detail.bodyMetrics.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Chưa có body metrics cho học viên này.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.bodyMetrics.map((entry: BodyMetricEntry) => (
                    <div key={entry.id} className="rounded-xl border border-border bg-muted/20 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{entry.recordedAt.toLocaleDateString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.coachName ? `Logged by ${entry.coachName}` : "Coach entry"}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Weight</p>
                            <p className="font-medium">{formatNumber(entry.weightKg, " kg")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Body fat</p>
                            <p className="font-medium">{formatNumber(entry.bodyFatPct, "%")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Waist</p>
                            <p className="font-medium">{formatNumber(entry.waistCm, " cm")}</p>
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

      <TabsContent value="checkins" className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={handleCreateCheckIn} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">New Check-in</h2>
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
                  placeholder="What should the trainee keep, change, or focus on next?"
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

              <Button type="submit" disabled={isSavingCheckIn} className="w-full bg-primary hover:bg-primary/90">
                {isSavingCheckIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save check-in
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Check-in History</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review feedback history and current trend.</p>

            {detail.checkIns.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Chưa có check-in nào cho học viên này.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {detail.checkIns.map((checkIn) => (
                  <div key={checkIn.id} className="rounded-xl border border-border bg-muted/20 px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{checkIn.checkInDate.toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">Coach: {checkIn.coachName}</p>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        Avg score {averageScore(checkIn) ?? "--"}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">Adherence</p>
                        <p className="text-lg font-semibold">{formatNumber(checkIn.adherenceScore)}</p>
                      </div>
                      <div className="rounded-lg bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">Energy</p>
                        <p className="text-lg font-semibold">{formatNumber(checkIn.energyScore)}</p>
                      </div>
                      <div className="rounded-lg bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">Recovery</p>
                        <p className="text-lg font-semibold">{formatNumber(checkIn.recoveryScore)}</p>
                      </div>
                      <div className="rounded-lg bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">Mood</p>
                        <p className="text-lg font-semibold">{formatNumber(checkIn.moodScore)}</p>
                      </div>
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
                      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
                        <span className="font-medium text-primary">Next focus:</span> {checkIn.nextFocus}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="logs" className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Workout Log History</h2>
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
