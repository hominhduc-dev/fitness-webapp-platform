"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Loader2,
  MessageSquareQuote,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Scale,
  Sun,
  Trash2,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { useState, useSyncExternalStore, type ReactNode } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { getInitials } from "@/components/coach/trainee-hub/trainee-status"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { formatReadinessScore } from "@/lib/fitness/readiness"
import type { CoachNote, CoachTraineeDetail } from "@/lib/fitness/types"
import { useCoachNoteMutations } from "@/lib/queries/coach"
import { formatDateKey } from "@/lib/time-zone"
import { cn } from "@/lib/utils"

type HubCopy = ReturnType<typeof useLocale>["messages"]["traineeHub"]

function subscribeToNothing() {
  return () => {}
}

/**
 * The browser's today and now, read on the client only: a server render has no
 * user zone, so anything relative to "today" waits for hydration rather than
 * render a day the client would disagree with.
 */
function useClientNow() {
  const todayKey = useSyncExternalStore(subscribeToNothing, () => formatDateKey(new Date()), () => null)
  return todayKey ? { now: new Date(), todayKey } : null
}

/** Day keys (`YYYY-MM-DD`) are calendar days, read in UTC so they never shift. */
function parseDayKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function Card({ action, children, className, icon, meta, title }: {
  action?: ReactNode
  children: ReactNode
  className?: string
  icon: ReactNode
  meta?: ReactNode
  title: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-5", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-primary [&_svg]:size-5" aria-hidden="true">{icon}</span>
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
        </div>
        {action ?? (meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null)}
      </header>
      {children}
    </section>
  )
}

/* ─── KPI row ──────────────────────────────────────────────────────────── */

/** Stacks icon over numbers in a narrow column (2×2 on a phone), side by side once there is room. */
const KPI_CARD = "flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm @2xl:flex-row @2xl:items-center @2xl:gap-3 @2xl:p-4"

function Kpi({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className={KPI_CARD}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary @2xl:size-11 [&_svg]:size-4 @2xl:[&_svg]:size-5">{icon}</span>
      <div className="min-w-0 text-xs @2xl:text-sm">{children}</div>
    </div>
  )
}

function AdherenceRing({ percent }: { percent: number | null }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const filled = percent === null ? 0 : Math.min(100, percent) / 100

  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center @2xl:size-14">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="var(--success)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled * circumference} ${circumference}`}
        />
      </svg>
      <span className="font-mono text-xs font-semibold tnum text-foreground">{percent === null ? "—" : `${percent}%`}</span>
    </span>
  )
}

function readinessLevel(score: number | null): "good" | "moderate" | "low" | null {
  if (score == null) return null
  // 70 is where the volume model counts a trainee as recovered.
  if (score >= 70) return "good"
  return score >= 40 ? "moderate" : "low"
}

const READINESS_TONE = { good: "text-success-text", low: "text-destructive-text", moderate: "text-warning-text" } as const

function KpiRow({ copy, dateLocale, detail }: { copy: HubCopy; dateLocale: Locale; detail: CoachTraineeDetail }) {
  const clientNow = useClientNow()
  const { week, lastWeekCompletedSessions } = detail.overview
  const percent = week.plannedSessions > 0 ? Math.min(100, Math.round((week.completedSessions / week.plannedSessions) * 100)) : null
  const trend = lastWeekCompletedSessions == null ? 0 : week.completedSessions - lastWeekCompletedSessions
  // The trainee's own recovery check-in, else the coach's latest check-in with them.
  const lastCheckIn = detail.recovery ? parseDayKey(detail.recovery.checkInDate) : detail.trainee.lastCheckInAt ?? null
  const readiness = detail.recovery?.readinessScore ?? null
  const level = readinessLevel(readiness)

  return (
    <div className="grid grid-cols-2 gap-3 @5xl:grid-cols-4">
      <div className={KPI_CARD}>
        <AdherenceRing percent={percent} />
        <div className="min-w-0 text-xs @2xl:text-sm">
          <p className="font-semibold text-foreground">{copy.planAdherence}</p>
          <p className="text-muted-foreground">{copy.sessionsOf(week.completedSessions, week.plannedSessions)}</p>
          <p className="text-muted-foreground">{copy.thisWeek}</p>
        </div>
      </div>
      <Kpi icon={<Dumbbell />}>
        <p className="font-mono text-lg font-semibold tnum text-foreground">{week.completedSessions}</p>
        <p className="text-muted-foreground">{copy.sessionsThisWeek}</p>
        {lastWeekCompletedSessions != null ? (
          <p className={cn("flex items-center gap-1 text-xs", trend > 0 ? "text-success-text" : trend < 0 ? "text-warning-text" : "text-muted-foreground")}>
            {copy.vsLastWeek(lastWeekCompletedSessions)}
            {trend > 0 ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : trend < 0 ? <ArrowDownRight className="size-3.5" aria-hidden="true" /> : null}
          </p>
        ) : null}
      </Kpi>
      <Kpi icon={<CalendarCheck />}>
        <p className="font-semibold text-foreground">
          {lastCheckIn
            ? clientNow
              ? formatDistanceToNowStrict(lastCheckIn, { addSuffix: true, locale: dateLocale })
              : lastCheckIn.toLocaleDateString(dateLocale.code, { day: "numeric", month: "short", timeZone: "UTC" })
            : copy.never}
        </p>
        <p className="text-muted-foreground">{copy.lastCheckIn}</p>
        {lastCheckIn ? (
          <p className="text-xs text-muted-foreground">
            {lastCheckIn.toLocaleDateString(dateLocale.code, { day: "numeric", month: "short", timeZone: "UTC", year: "numeric" })}
          </p>
        ) : null}
      </Kpi>
      <Kpi icon={<Zap />}>
        <p className="font-mono text-lg font-semibold tnum text-foreground">
          {formatReadinessScore(readiness)}
          <span className="text-xs font-normal text-muted-foreground">/100</span>
        </p>
        <p className="text-muted-foreground">{copy.readiness}</p>
        <p className={cn("text-xs font-medium", level ? READINESS_TONE[level] : "text-muted-foreground")}>
          {level ? copy.readinessLevels[level] : copy.notRecorded}
        </p>
      </Kpi>
    </div>
  )
}

/* ─── Today's status ──────────────────────────────────────────────────── */

function TodayStatusCard({ copy, dateLocale, detail }: { copy: HubCopy; dateLocale: Locale; detail: CoachTraineeDetail }) {
  const clientNow = useClientNow()
  const recovery = detail.recovery
  const isToday = Boolean(recovery && clientNow && recovery.checkInDate === clientNow.todayKey)
  const formatDay = (dateKey: string) => parseDayKey(dateKey).toLocaleDateString(dateLocale.code, { day: "numeric", month: "short", timeZone: "UTC" })

  let tone: "ready" | "caution" | "rest" = "ready"
  if (recovery) {
    const score = recovery.readinessScore
    if (recovery.fatigue >= 4 || (score != null && score < 40)) tone = "rest"
    else if (recovery.fatigue >= 3 || (score != null && score < 70)) tone = "caution"
  }
  const status = {
    caution: { className: "border-warning/30 bg-warning-soft text-warning-text", copy: copy.statusCautionCopy, title: copy.statusCaution },
    ready: { className: "border-success/25 bg-ok-soft text-success-text", copy: copy.statusReadyCopy, title: copy.statusReady },
    rest: { className: "border-destructive/25 bg-destructive-soft text-destructive-text", copy: copy.statusRestCopy, title: copy.statusRest },
  }[tone]

  return (
    <Card icon={<Sun />} title={copy.todayStatus} meta={clientNow ? formatDay(clientNow.todayKey) : null}>
      {recovery && isToday ? (
        <div className="space-y-3">
          <div className={cn("rounded-xl border px-4 py-3", status.className)}>
            <p className="text-base font-semibold">{status.title}</p>
            <p className="mt-0.5 text-sm opacity-90">{status.copy}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs opacity-80">
              {recovery.sleepMinutes != null ? <span>{copy.sleep((recovery.sleepMinutes / 60).toFixed(1))}</span> : null}
              <span>{copy.fatigue(recovery.fatigue)}</span>
            </p>
          </div>
          {recovery.note ? (
            <div className="flex gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm italic text-muted-foreground">{recovery.note}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">{copy.noCheckInToday}</p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.noCheckInTodayCopy(recovery ? formatDay(recovery.checkInDate) : null)}</p>
        </div>
      )}
    </Card>
  )
}

/* ─── Current program ─────────────────────────────────────────────────── */

function CurrentProgramCard({ copy, dateLocale, detail }: { copy: HubCopy; dateLocale: Locale; detail: CoachTraineeDetail }) {
  const clientNow = useClientNow()
  const program = detail.programs.find((candidate) => !candidate.archivedAt) ?? detail.programs[0]

  if (!program) {
    return (
      <Card icon={<ClipboardList />} title={copy.currentProgram}>
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{copy.noProgramCopy}</p>
      </Card>
    )
  }

  // Week 1 starts on the program's start date, else on the day it was assigned.
  const assignedAt = program.assignedTrainees.find((trainee) => trainee.id === detail.trainee.id)?.assignedAt
  const anchor = program.startDate ? parseDayKey(program.startDate) : assignedAt ?? null
  const elapsedWeeks = anchor && clientNow ? Math.floor((clientNow.now.getTime() - anchor.getTime()) / (7 * 86_400_000)) : null
  const currentWeek = elapsedWeeks === null ? null : Math.min(program.duration, Math.max(1, elapsedWeeks + 1))
  const progress = currentWeek === null ? 0 : Math.round((currentWeek / Math.max(1, program.duration)) * 100)
  const { week } = detail.overview

  return (
    <Card
      icon={<ClipboardList />}
      title={copy.currentProgram}
      meta={anchor ? copy.startedOn(anchor.toLocaleDateString(dateLocale.code, { day: "numeric", month: "short", year: "numeric", timeZone: program.startDate ? "UTC" : undefined })) : null}
    >
      <Link
        href={`/coach/programs/${program.id}?adjustTrainee=${detail.trainee.id}`}
        className="group -m-2 flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40"
      >
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary @lg:size-20">
          <Dumbbell className="size-7" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">{program.name}</span>
            {!program.archivedAt ? (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-micro font-semibold text-primary">{copy.active}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{copy.programMeta(program.duration, program.workoutsPerWeek)}</span>
          {program.description ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{program.description}</span> : null}
        </span>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">{currentWeek === null ? " " : copy.weekOf(currentWeek, program.duration)}</span>
          <span className="font-mono text-xs tnum text-muted-foreground">{progress}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{copy.sessionsCompletedThisWeek(week.completedSessions, week.plannedSessions)}</p>
      </div>
    </Card>
  )
}

/* ─── Recent workout activity ─────────────────────────────────────────── */

function RecentActivityCard({ copy, dateLocale, detail, onViewAll }: {
  copy: HubCopy
  dateLocale: Locale
  detail: CoachTraineeDetail
  onViewAll: () => void
}) {
  const logs = detail.recentLogs.slice(0, 4)

  return (
    <Card
      icon={<Dumbbell />}
      title={copy.recentActivity}
      action={logs.length > 0 ? (
        <button type="button" onClick={onViewAll} className="shrink-0 text-sm font-medium text-primary hover:underline">{copy.viewAll}</button>
      ) : null}
    >
      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{copy.noActivity}</p>
      ) : (
        <ul className="divide-y divide-border">
          {logs.map((log) => {
            const minutes = log.completedAt ? Math.max(1, Math.round((log.completedAt.getTime() - log.startedAt.getTime()) / 60_000)) : null
            return (
              <li key={log.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted/60 py-1 leading-tight">
                  <span className="font-mono text-micro uppercase text-muted-foreground">{log.startedAt.toLocaleDateString(dateLocale.code, { month: "short" })}</span>
                  <span className="font-mono text-base font-semibold tnum text-foreground">{log.startedAt.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{log.workout?.name ?? "Workout"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[copy.exercisesCount(log.exercises.length), minutes ? copy.minutes(minutes) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className={cn("shrink-0 text-xs font-medium", log.completedAt ? "text-success-text" : "text-warning-text")}>
                  {log.completedAt ? copy.completed : copy.inProgress}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ─── Body metrics ────────────────────────────────────────────────────── */

const METRICS = [
  { key: "weightKg", unit: "kg" },
  { key: "bodyFatPct", unit: "%" },
  { key: "waistCm", unit: "cm" },
] as const

type MetricKey = (typeof METRICS)[number]["key"]

function BodyMetricsCard({ copy, dateLocale, detail }: { copy: HubCopy; dateLocale: Locale; detail: CoachTraineeDetail }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("weightKg")
  const metric = METRICS.find((item) => item.key === metricKey) ?? METRICS[0]
  const labels: Record<MetricKey, string> = { bodyFatPct: copy.bodyFat, waistCm: copy.waist, weightKg: copy.weight }
  // Entries arrive newest first; the chart reads left to right in time.
  const points = [...detail.bodyMetrics]
    .reverse()
    .flatMap((entry) => {
      const value = entry[metricKey]
      return value == null ? [] : [{ label: entry.recordedAt.toLocaleDateString(dateLocale.code, { day: "numeric", month: "short" }), value }]
    })
  const first = points[0]?.value
  const last = points.at(-1)?.value
  const delta = first != null && last != null ? Math.round((last - first) * 10) / 10 : null
  const goal = metricKey === "weightKg" ? detail.about.targetWeightKg : null
  const values = points.map((point) => point.value).concat(goal != null ? [goal] : [])
  const domain: [number, number] = values.length
    ? [Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)]
    : [0, 1]

  return (
    <Card icon={<Scale />} title={copy.bodyMetrics}>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={copy.bodyMetrics}>
        {METRICS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={metricKey === item.key}
            onClick={() => setMetricKey(item.key)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              metricKey === item.key ? "bg-primary-soft text-primary" : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[item.key]}
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{copy.noMetrics}</p>
      ) : (
        <>
          <div className="h-44 @lg:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={16} />
                <YAxis domain={domain} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={44} />
                <Tooltip
                  formatter={(value) => [`${value} ${metric.unit}`, labels[metricKey]]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-3 grid grid-cols-3 divide-x divide-border text-center">
            <div>
              <dt className="text-xs text-muted-foreground">{copy.start}</dt>
              <dd className="font-mono text-sm font-semibold tnum text-foreground">{first} {metric.unit}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.current}</dt>
              <dd className="font-mono text-sm font-semibold tnum text-foreground">{last} {metric.unit}</dd>
              {delta ? (
                <dd className={cn("font-mono text-xs tnum", delta < 0 ? "text-success-text" : "text-warning-text")}>
                  {delta > 0 ? "+" : ""}{delta} {metric.unit}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.goal}</dt>
              <dd className="font-mono text-sm font-semibold tnum text-foreground">{goal != null ? `${goal} ${metric.unit}` : "—"}</dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  )
}

/* ─── Notes from coach ────────────────────────────────────────────────── */

function CoachNotesCard({ copy, dateLocale, notes, onNotesChange, traineeId }: {
  copy: HubCopy
  dateLocale: Locale
  notes: CoachNote[]
  onNotesChange: (notes: CoachNote[]) => void
  traineeId: string
}) {
  const mutations = useCoachNoteMutations(traineeId)
  // null: no form open; "new": adding; otherwise the id of the note being edited.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const saving = mutations.create.isPending || mutations.update.isPending

  const openForm = (target: string, body = "") => {
    setEditing(target)
    setDraft(body)
    setError(null)
  }

  const save = async () => {
    const body = draft.trim()
    if (!body || !editing) return
    setError(null)
    try {
      if (editing === "new") {
        const note = await mutations.create.mutateAsync(body)
        onNotesChange([note, ...notes])
      } else {
        const note = await mutations.update.mutateAsync({ body, noteId: editing })
        onNotesChange(notes.map((item) => (item.id === note.id ? note : item)))
      }
      setEditing(null)
      setDraft("")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.noteError)
    }
  }

  const remove = async (noteId: string) => {
    setError(null)
    try {
      await mutations.remove.mutateAsync(noteId)
      onNotesChange(notes.filter((item) => item.id !== noteId))
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : copy.noteError)
    }
  }

  const form = (
    <div className="space-y-2">
      <Textarea
        autoFocus
        rows={3}
        maxLength={2000}
        value={draft}
        placeholder={copy.notePlaceholder}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={copy.notes}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(null)}>{copy.cancel}</Button>
        <Button size="sm" disabled={saving || !draft.trim()} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {copy.save}
        </Button>
      </div>
    </div>
  )

  return (
    <Card
      icon={<NotebookPen />}
      title={copy.notes}
      action={editing === "new" ? null : (
        <button type="button" onClick={() => openForm("new")} className="shrink-0 text-sm font-medium text-primary hover:underline">{copy.addNote}</button>
      )}
    >
      {error ? <p className="mb-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{error}</p> : null}
      {editing === "new" ? <div className="mb-4">{form}</div> : null}
      {notes.length === 0 && editing !== "new" ? (
        <p className="text-sm text-muted-foreground">{copy.noNotes}</p>
      ) : (
        <ul className="divide-y divide-border">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {getInitials(note.coachName)}
              </span>
              <div className="min-w-0 flex-1 @2xl:flex @2xl:gap-6">
                <div className="shrink-0 @2xl:w-36">
                  <p className="text-sm font-semibold text-foreground">{note.coachName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.createdAt).toLocaleDateString(dateLocale.code, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {editing === note.id ? (
                  <div className="mt-2 min-w-0 flex-1 @2xl:mt-0">{form}</div>
                ) : (
                  <p className="mt-1 min-w-0 flex-1 whitespace-pre-line text-sm text-muted-foreground @2xl:mt-0">{note.body}</p>
                )}
              </div>
              {editing === note.id ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label={`${copy.edit} / ${copy.delete}`} disabled={mutations.remove.isPending}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openForm(note.id, note.body)}><Pencil />{copy.edit}</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => void remove(note.id)}><Trash2 />{copy.delete}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ─── Overview ────────────────────────────────────────────────────────── */

type Locale = typeof enUS

/**
 * One trainee at a glance: this week's numbers, how they feel today, their
 * program, what they trained, their body trend and the coach's notes. Lays out
 * against its own width (container queries), so it reads the same beside the
 * roster on a laptop as alone on a phone.
 */
export function TraineeOverview({ detail, onNotesChange, onViewLogs }: {
  detail: CoachTraineeDetail
  onNotesChange: (notes: CoachNote[]) => void
  onViewLogs: () => void
}) {
  const { locale, messages } = useLocale()
  const copy = messages.traineeHub
  const dateLocale = locale === "vi" ? vi : enUS

  return (
    <div className="space-y-4">
      <KpiRow copy={copy} dateLocale={dateLocale} detail={detail} />
      <div className="grid gap-4 @4xl:grid-cols-2">
        <TodayStatusCard copy={copy} dateLocale={dateLocale} detail={detail} />
        <CurrentProgramCard copy={copy} dateLocale={dateLocale} detail={detail} />
        <RecentActivityCard copy={copy} dateLocale={dateLocale} detail={detail} onViewAll={onViewLogs} />
        <BodyMetricsCard copy={copy} dateLocale={dateLocale} detail={detail} />
      </div>
      <CoachNotesCard
        copy={copy}
        dateLocale={dateLocale}
        notes={detail.notes}
        onNotesChange={onNotesChange}
        traineeId={detail.trainee.id}
      />
    </div>
  )
}
