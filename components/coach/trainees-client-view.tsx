"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Search,
  StickyNote,
} from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { fetchCoachTraineeDetail } from "@/lib/fitness/api"
import type { CoachProgram, CoachTrainee, CoachTraineeDetail } from "@/lib/fitness/types"
import type { WorkoutLog } from "@/lib/types"

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
}

type Status = "on-track" | "behind" | "rest"

function deriveStatus(t: CoachTrainee): Status {
  const planned = t.plannedSessionsPerWeek ?? 0
  const done = t.thisWeekWorkouts
  if (planned === 0 && done === 0) return "rest"
  const rate = planned > 0 ? done / planned : (t.completionRate ?? 0) / 100
  if (rate >= 0.8) return "on-track"
  if (rate === 0) return "rest"
  return "behind"
}

const STATUS_COLOR: Record<Status, string> = {
  "on-track": "var(--success)",
  behind: "var(--warning)",
  rest: "color-mix(in srgb, var(--muted-foreground) 40%, transparent)",
}
const STATUS_LABEL: Record<Status, string> = {
  "on-track": "On track",
  behind: "Behind",
  rest: "Rest week",
}
const STATUS_BADGE: Record<Status, string> = {
  "on-track": "bg-success/10 text-success border-success/20",
  behind: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  rest: "bg-muted text-muted-foreground border-border",
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const FILTERS = [
  { key: "all", label: "All" },
  { key: "on-track", label: "On track" },
  { key: "behind", label: "Behind" },
  { key: "rest", label: "Rest" },
] as const

/* derive a 7-element array: sets per day Mon–Sun for the last 7 days */
function weeklySetsByDay(logs: WorkoutLog[]): number[] {
  const slots = [0, 0, 0, 0, 0, 0, 0]
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 6)
  cutoff.setHours(0, 0, 0, 0)

  for (const log of logs) {
    const d = new Date(log.startedAt)
    if (d < cutoff) continue
    // day of week: 0=Sun … 6=Sat → map to Mon=0 … Sun=6
    const dow = (d.getDay() + 6) % 7
    const sets = log.exercises.reduce((acc, e) => acc + e.sets.length, 0)
    slots[dow] += sets || 1 // at minimum count the session
  }
  return slots
}

/* pick top-3 exercises by max weight from recent logs */
type KeyLift = { name: string; value: string; delta: string; isNew?: boolean }

function deriveKeyLifts(logs: WorkoutLog[]): KeyLift[] {
  const byExercise: Record<string, { maxWeight: number; prev: number; count: number }> = {}

  const sorted = [...logs].sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt))

  for (const log of sorted) {
    for (const ex of log.exercises) {
      const name = ex.exercise.name
      const maxW = Math.max(0, ...ex.sets.map((s) => s.weight ?? 0))
      if (!byExercise[name]) {
        byExercise[name] = { maxWeight: maxW, prev: 0, count: 0 }
      } else {
        byExercise[name].prev = byExercise[name].maxWeight
        byExercise[name].maxWeight = Math.max(byExercise[name].maxWeight, maxW)
        byExercise[name].count++
      }
    }
  }

  return Object.entries(byExercise)
    .filter(([, v]) => v.maxWeight > 0)
    .sort((a, b) => b[1].maxWeight - a[1].maxWeight)
    .slice(0, 3)
    .map(([name, v]) => {
      const delta = v.maxWeight - v.prev
      return {
        name,
        value: v.maxWeight.toFixed(1),
        delta: delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? `−${Math.abs(delta).toFixed(1)}` : "+0.0",
        isNew: v.count === 0,
      }
    })
}

/* ------------------------------------------------------------------ */
/* AssignWorkoutModal                                                   */
/* ------------------------------------------------------------------ */

type AssignWorkoutModalProps = {
  trainee: CoachTrainee
  programs: CoachProgram[]
  onClose: () => void
  onAssigned: () => void
}

function buildUpcomingDays(n = 14) {
  const days: { iso: string; date: string; day: string; label?: string }[] = []
  const today = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const day = d.toLocaleDateString("en-US", { weekday: "short" })
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : undefined
    days.push({ iso, date, day, label })
  }
  return days
}

const UPCOMING_DAYS = buildUpcomingDays()

function AssignWorkoutModal({ trainee, programs, onClose, onAssigned }: AssignWorkoutModalProps) {
  const { session } = useAuth()
  const [tab, setTab] = useState<"routine" | "program">("program")
  const [pickedProgram, setPickedProgram] = useState<CoachProgram | null>(null)
  const [pickedDate, setPickedDate] = useState(UPCOMING_DAYS[0].iso)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const canAssign = tab === "program" ? !!pickedProgram : false

  const handleAssign = async () => {
    if (!canAssign || !session?.access_token) return
    setSaving(true)
    try {
      if (tab === "program" && pickedProgram) {
        const { assignCoachProgram } = await import("@/lib/fitness/api")
        await assignCoachProgram(session.access_token, pickedProgram.id, trainee.id)
      }
      onAssigned()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] max-w-[580px] flex-col gap-0 overflow-hidden rounded-[14px] p-0">
        <VisuallyHidden><DialogTitle>Assign workout</DialogTitle></VisuallyHidden>
        {/* Header */}
        <div className="border-b border-border px-6 pb-4 pt-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="label-micro text-muted-foreground">Assign to {trainee.name}</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Assign workout</h2>
            </div>
          </div>
          {/* Tab chips */}
          <div className="flex gap-2">
            {(["program", "routine"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                  tab === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {t === "program" ? "Full program" : "Single routine"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {tab === "program" && (
            <div>
              <p className="label-micro mb-2.5 text-muted-foreground">Pick a program</p>
              <div className="flex flex-col gap-2">
                {programs.map((p) => {
                  const isPicked = pickedProgram?.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPickedProgram(p)}
                      className={cn(
                        "rounded-[10px] border p-3.5 text-left transition-all",
                        isPicked
                          ? "border-primary bg-card shadow-[0_0_0_3px_rgba(58,95,255,0.12)]"
                          : "border-border bg-muted/30 hover:border-border/80",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{p.name}</p>
                          <p className="label-micro mt-0.5 text-muted-foreground tnum">
                            {p.duration} weeks · {p.workoutsPerWeek} days/week · {p.assignedTrainees.length} on it
                          </p>
                          {p.description && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                          )}
                        </div>
                        {isPicked && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />}
                      </div>
                    </button>
                  )
                })}
                {programs.length === 0 && (
                  <div className="rounded-[10px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No programs yet.{" "}
                    <Link href="/coach/programs/new" className="text-primary underline-offset-2 hover:underline">
                      Build one first.
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "routine" && (
            <div className="rounded-[10px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Single-routine assignment coming soon. Use "Full program" to assign a structured plan.
            </div>
          )}

          {/* Date picker */}
          <div>
            <p className="label-micro mb-2.5 text-muted-foreground">
              {tab === "program" ? "Start date" : "Schedule for"}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {UPCOMING_DAYS.map((d) => {
                const isPicked = pickedDate === d.iso
                return (
                  <button
                    key={d.iso}
                    onClick={() => setPickedDate(d.iso)}
                    className={cn(
                      "flex min-w-[60px] flex-shrink-0 flex-col items-center gap-0.5 rounded-md border px-2.5 py-2 transition-all font-mono",
                      isPicked
                        ? "border-primary text-primary shadow-[0_0_0_3px_rgba(58,95,255,0.12)]"
                        : "border-border text-muted-foreground hover:border-border/80",
                    )}
                  >
                    <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {d.label ?? d.day}
                    </span>
                    <span className="text-[14px] font-semibold tnum">{d.date.split(" ")[1]}</span>
                    <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {d.date.split(" ")[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="label-micro mb-2 text-muted-foreground">Note to client (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Focus on bar path on bench. Video your top set."
              rows={3}
              className="w-full resize-y rounded-[8px] border border-border bg-background px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Preview */}
          {canAssign && pickedProgram && (
            <div className="rounded-[10px] border border-border bg-muted/40 p-4">
              <p className="label-micro mb-1.5 text-muted-foreground">Preview</p>
              <p className="text-[13px] leading-relaxed text-foreground">
                {trainee.name} will start{" "}
                <span className="font-semibold">{pickedProgram.name}</span> ({pickedProgram.duration}-week
                program) on{" "}
                <span className="font-mono font-semibold tnum">
                  {UPCOMING_DAYS.find((d) => d.iso === pickedDate)?.date}
                </span>
                .
              </p>
              {note && <p className="mt-2 text-[12px] italic text-muted-foreground">"{note}"</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!canAssign || saving}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Assign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* ClientRow                                                            */
/* ------------------------------------------------------------------ */

type ClientRowProps = {
  trainee: CoachTrainee
  selected: boolean
  onClick: () => void
}

function ClientRow({ trainee, selected, onClick }: ClientRowProps) {
  const status = deriveStatus(trainee)
  const program = trainee.programCount > 0
    ? `${trainee.programCount} program${trainee.programCount !== 1 ? "s" : ""}`
    : "No program"
  const lastSeen = trainee.lastCheckInAt
    ? trainee.lastCheckInAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : trainee.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-6 py-[14px] text-left transition-colors",
        "border-l-[3px]",
        selected
          ? "border-l-primary bg-muted/50"
          : "border-l-transparent hover:bg-muted/30",
      )}
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={trainee.avatar ?? undefined} />
        <AvatarFallback className="bg-muted text-[13px] font-medium text-foreground">
          {getInitials(trainee.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{trainee.name}</span>
          <span
            className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
            style={{ background: STATUS_COLOR[status] }}
            title={STATUS_LABEL[status]}
          />
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {program} · {lastSeen}
        </div>
      </div>

      <ChevronRight className="h-[14px] w-[14px] flex-shrink-0 text-muted-foreground" />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* ClientDetail                                                         */
/* ------------------------------------------------------------------ */

type ClientDetailProps = {
  trainee: CoachTrainee
  detail: CoachTraineeDetail | null
  loading: boolean
  onAssign: () => void
  onBack?: () => void
  isMobile?: boolean
}

function ClientDetail({ trainee, detail, loading, onAssign, onBack, isMobile }: ClientDetailProps) {
  const status = deriveStatus(trainee)
  const weekly = detail ? weeklySetsByDay(detail.recentLogs) : []
  const maxSets = Math.max(...weekly, 6)
  const totalSets = weekly.reduce((a, b) => a + b, 0)
  const keyLifts = detail ? deriveKeyLifts(detail.recentLogs) : []
  const recentLogs = detail?.recentLogs.slice(0, 5) ?? []
  const activeProgram = detail?.programs[0]

  return (
    <div
      className={cn(
        "overflow-y-auto",
        isMobile ? "px-0 py-0" : "px-9 py-7",
      )}
      style={{ maxHeight: isMobile ? undefined : "100vh" }}
    >
      {isMobile && onBack && (
        <button
          onClick={onBack}
          className="mb-3.5 flex items-center gap-1.5 text-[13px] text-muted-foreground"
        >
          <ChevronLeft className="h-[14px] w-[14px]" />
          All clients
        </button>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar className="h-16 w-16 flex-shrink-0 border border-border">
          <AvatarImage src={trainee.avatar ?? undefined} />
          <AvatarFallback className="bg-muted text-xl font-medium text-foreground">
            {getInitials(trainee.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          {activeProgram && (
            <p className="label-micro mb-1 text-muted-foreground">{activeProgram.name}</p>
          )}
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {trainee.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="micro" className={STATUS_BADGE[status]}>
              {STATUS_LABEL[status]}
            </Badge>
            <span className="font-mono text-[12px] text-muted-foreground">
              · {trainee.thisWeekWorkouts}-day streak · last seen{" "}
              {trainee.lastCheckInAt
                ? trainee.lastCheckInAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "unknown"}
            </span>
          </div>
        </div>

        {!isMobile && (
          <div className="flex gap-2">
            <Button variant="outline">
              <MessageSquare className="mr-1.5 h-[14px] w-[14px]" />
              Message
            </Button>
            <Button onClick={onAssign}>
              <Plus className="mr-1.5 h-[14px] w-[14px]" />
              Assign workout
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading training data…</div>
      )}

      {!loading && detail && (
        <>
          {/* Weekly bar chart */}
          <div className="mb-6 rounded-[10px] border border-border bg-card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <p className="label-micro text-muted-foreground">This week · sets per day</p>
                <div className="mt-1.5 font-mono text-[22px] font-medium tnum">
                  {totalSets} <span className="text-[13px] text-muted-foreground">sets</span>
                </div>
              </div>
              <span className="label-micro text-muted-foreground tnum">
                vs plan: {(trainee.plannedSessionsPerWeek ?? 0) * 5}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2" style={{ height: 110, alignItems: "end" }}>
              {DAYS.map((day, i) => {
                const v = weekly[i] ?? 0
                const isToday = i === (new Date().getDay() + 6) % 7
                const h = v === 0 ? 4 : Math.max(8, (v / maxSets) * 90)
                return (
                  <div key={day} className="flex h-full flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${h}%`,
                          background:
                            v === 0
                              ? "var(--muted)"
                              : isToday
                                ? "var(--primary)"
                                : "var(--foreground)",
                        }}
                      />
                    </div>
                    <span className="label-micro text-muted-foreground">{day}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Key lifts */}
          {keyLifts.length > 0 && (
            <>
              <p className="label-micro mb-3 text-muted-foreground">Key lifts (estimated 1RM)</p>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {keyLifts.map((k) => (
                  <div key={k.name} className="rounded-[10px] border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">{k.name}</span>
                      {k.isNew && (
                        <Badge variant="micro" className="bg-primary/10 text-primary border-primary/20">
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-[28px] font-semibold tracking-[-0.03em] tnum">
                        {k.value}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[12px]",
                          k.delta.startsWith("+") && k.delta !== "+0.0"
                            ? "text-success"
                            : k.delta.startsWith("−")
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {k.delta === "+0.0" ? "flat" : k.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Recent sessions */}
          <p className="label-micro mb-3 text-muted-foreground">Recent sessions</p>
          <div className="rounded-[10px] border border-border bg-card overflow-hidden">
            {recentLogs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No sessions logged yet.</p>
            ) : (
              recentLogs.map((log, i) => {
                const complete = log.completedAt ? 1 : 0
                const vol = log.totalVolume ?? 0
                return (
                  <Link
                    key={log.id}
                    href={`/coach/trainees/${trainee.id}`}
                    className={cn(
                      "grid items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30",
                      "grid-cols-[80px_1fr_100px_100px_24px]",
                      i < recentLogs.length - 1 && "border-b border-border",
                    )}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {new Date(log.startedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="truncate text-sm font-medium">{log.workout.name}</span>
                    <span className="font-mono text-[13px] text-foreground tnum">
                      {vol > 0 ? `${(vol / 1000).toFixed(1)}k kg` : "—"}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[13px] tnum",
                        complete === 1 ? "text-success" : "text-warning",
                      )}
                    >
                      {complete === 1 ? "100%" : "In prog."}
                    </span>
                    <ChevronRight className="h-[14px] w-[14px] text-muted-foreground" />
                  </Link>
                )
              })
            )}
          </div>

          {isMobile && (
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1 justify-center">
                <MessageSquare className="mr-1.5 h-[14px] w-[14px]" />
                Message
              </Button>
              <Button className="flex-1 justify-center" onClick={onAssign}>
                <Plus className="mr-1.5 h-[14px] w-[14px]" />
                Assign workout
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* TraineesClientView (main export)                                     */
/* ------------------------------------------------------------------ */

type Props = {
  initialTrainees: CoachTrainee[]
  programs: CoachProgram[]
}

export function TraineesClientView({ initialTrainees, programs }: Props) {
  const { session } = useAuth()
  const [trainees] = useState(initialTrainees)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTrainees.length > 0 ? initialTrainees[0].id : null,
  )
  const [detail, setDetail] = useState<CoachTraineeDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"all" | "on-track" | "behind" | "rest">("all")
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")
  const [assignModal, setAssignModal] = useState(false)

  const loadDetail = useCallback(
    async (id: string) => {
      if (!session?.access_token) return
      setLoading(true)
      setDetail(null)
      try {
        const d = await fetchCoachTraineeDetail(session.access_token, id)
        setDetail(d)
      } finally {
        setLoading(false)
      }
    },
    [session],
  )

  // Load detail for initial selection
  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setMobileView("detail")
    loadDetail(id)
  }

  const selectedTrainee = trainees.find((t) => t.id === selectedId) ?? null

  const statusedTrainees = trainees.map((t) => ({ ...t, _status: deriveStatus(t) }))
  const visible = statusedTrainees.filter((t) => {
    if (filter !== "all" && t._status !== filter) return false
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  // ---- List panel ----
  const ListPanel = (
    <div
      className="flex flex-col border-r border-border bg-card"
      style={{ width: 360, flexShrink: 0, minHeight: "100vh" }}
    >
      {/* List header */}
      <div className="border-b border-border px-6 pb-3 pt-5">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <span className="label-micro text-muted-foreground tnum">{trainees.length} total</span>
        </div>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-[11px] h-[14px] w-[14px] text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients…"
            className="pl-9"
          />
        </div>
        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                filter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No clients match.</p>
        ) : (
          visible.map((t) => (
            <ClientRow
              key={t.id}
              trainee={t}
              selected={selectedId === t.id}
              onClick={() => handleSelect(t.id)}
            />
          ))
        )}
      </div>
    </div>
  )

  // ---- Detail panel (when a trainee is selected) ----
  const DetailPanel = selectedTrainee ? (
    <div className="min-w-0 flex-1">
      <ClientDetail
        trainee={selectedTrainee}
        detail={detail}
        loading={loading}
        onAssign={() => setAssignModal(true)}
        isMobile={false}
      />
    </div>
  ) : (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Select a client to see their training.
    </div>
  )

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // ---- Mobile ----
  if (isMobile) {
    return (
      <div>
        {mobileView === "list" ? (
          <div>
            <div className="border-b border-border px-4 pb-3 pt-5">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h1 className="text-[22px] font-semibold tracking-tight">Clients</h1>
                <span className="label-micro text-muted-foreground tnum">{trainees.length} total</span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-[11px] h-[14px] w-[14px] text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search clients…"
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                      filter === key
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {visible.map((t) => (
                <ClientRow
                  key={t.id}
                  trainee={t}
                  selected={false}
                  onClick={() => handleSelect(t.id)}
                />
              ))}
            </div>
          </div>
        ) : selectedTrainee ? (
          <div className="px-4 py-5">
            <ClientDetail
              trainee={selectedTrainee}
              detail={detail}
              loading={loading}
              onAssign={() => setAssignModal(true)}
              onBack={() => setMobileView("list")}
              isMobile
            />
          </div>
        ) : null}

        {assignModal && selectedTrainee && (
          <AssignWorkoutModal
            trainee={selectedTrainee}
            programs={programs}
            onClose={() => setAssignModal(false)}
            onAssigned={() => setAssignModal(false)}
          />
        )}
      </div>
    )
  }

  // ---- Desktop ----
  return (
    <div className="flex min-h-screen">
      {ListPanel}
      {DetailPanel}

      {assignModal && selectedTrainee && (
        <AssignWorkoutModal
          trainee={selectedTrainee}
          programs={programs}
          onClose={() => setAssignModal(false)}
          onAssigned={() => setAssignModal(false)}
        />
      )}
    </div>
  )
}
