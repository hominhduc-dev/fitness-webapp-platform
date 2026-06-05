"use client"

import {
  Check,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RestTimer, type RestEvent } from "@/components/workout/rest-timer"
import { createWorkoutLog, fetchExercises, fetchWorkoutDetail } from "@/lib/fitness/api"
import { markDashboardForRefresh } from "@/lib/fitness/dashboard-refresh"
import { cn } from "@/lib/utils"
import type { ExerciseSet, ExerciseVariationOption, WorkoutExercise, Workout } from "@/lib/types"
import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { AppMessages } from "@/lib/i18n/messages"

// ─── Session storage helpers (unchanged) ──────────────────────────────────────

const WORKOUT_SESSION_STORAGE_PREFIX = "workout-session"

type StoredWorkoutSession = {
  currentExerciseIndex: number
  exercises: Array<{
    id: string
    sets: Array<{
      actualReps?: number
      completed: boolean
      id: string
      notes?: string
      rir?: number
      weight?: number
    }>
  }>
  startedAt: string
}

function getWorkoutSessionStorageKey(workoutId: string) {
  return `${WORKOUT_SESSION_STORAGE_PREFIX}:${workoutId}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function hasSessionProgress(exercises: Workout["exercises"]) {
  return exercises.some((exercise) =>
    exercise.sets.some(
      (set) =>
        set.completed ||
        set.weight != null ||
        set.actualReps != null ||
        set.notes?.trim() ||
        set.rir != null,
    ),
  )
}

function sanitizeStoredWorkoutExercises(rawExercises: unknown): StoredWorkoutSession["exercises"] {
  if (!Array.isArray(rawExercises)) return []

  return rawExercises.flatMap((exercise: unknown) => {
    if (typeof exercise !== "object" || exercise === null) return []
    const exerciseRecord = exercise as { id?: unknown; sets?: unknown }
    if (typeof exerciseRecord.id !== "string") return []
    const rawSets = Array.isArray(exerciseRecord.sets) ? exerciseRecord.sets : []
    return [
      {
        id: exerciseRecord.id,
        sets: rawSets.flatMap((set: unknown) => {
          if (typeof set !== "object" || set === null) return []
          const setRecord = set as {
            actualReps?: unknown
            completed?: unknown
            id?: unknown
            notes?: unknown
            rir?: unknown
            weight?: unknown
          }
          if (typeof setRecord.id !== "string") return []
          return [
            {
              actualReps: isFiniteNumber(setRecord.actualReps) ? setRecord.actualReps : undefined,
              completed: Boolean(setRecord.completed),
              id: setRecord.id,
              notes: typeof setRecord.notes === "string" ? setRecord.notes : undefined,
              rir: isFiniteNumber(setRecord.rir) ? setRecord.rir : undefined,
              weight: isFiniteNumber(setRecord.weight) ? setRecord.weight : undefined,
            },
          ]
        }),
      },
    ]
  })
}

function readStoredWorkoutSession(workoutId: string) {
  const rawValue = window.localStorage.getItem(getWorkoutSessionStorageKey(workoutId))
  if (!rawValue) return null
  try {
    const parsed = JSON.parse(rawValue)
    if (typeof parsed !== "object" || parsed === null) {
      window.localStorage.removeItem(getWorkoutSessionStorageKey(workoutId))
      return null
    }
    const currentExerciseIndex = isFiniteNumber(parsed.currentExerciseIndex) ? parsed.currentExerciseIndex : 0
    const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString()
    const exercises = sanitizeStoredWorkoutExercises(parsed.exercises)
    return { currentExerciseIndex, exercises, startedAt } satisfies StoredWorkoutSession
  } catch {
    window.localStorage.removeItem(getWorkoutSessionStorageKey(workoutId))
    return null
  }
}

function createStoredWorkoutSession(
  exercises: Workout["exercises"],
  startedAt: Date,
  currentExerciseIndex: number,
): StoredWorkoutSession {
  return {
    currentExerciseIndex,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      sets: exercise.sets.map((set) => ({
        actualReps: set.actualReps,
        completed: set.completed,
        id: set.id,
        notes: set.notes,
        rir: set.rir,
        weight: set.weight,
      })),
    })),
    startedAt: startedAt.toISOString(),
  }
}

function restoreWorkoutSessionExercises(
  baseExercises: Workout["exercises"],
  storedExercises: StoredWorkoutSession["exercises"],
) {
  const storedExercisesById = new Map(storedExercises.map((exercise) => [exercise.id, exercise]))
  return baseExercises.map((exercise) => {
    const storedExercise = storedExercisesById.get(exercise.id)
    if (!storedExercise) return exercise
    const storedSetsById = new Map(storedExercise.sets.map((set) => [set.id, set]))

    const restoredSets = exercise.sets.map((set) => {
      const storedSet = storedSetsById.get(set.id)
      if (!storedSet) return set
      return {
        ...set,
        actualReps: isFiniteNumber(storedSet.actualReps) ? storedSet.actualReps : undefined,
        completed: Boolean(storedSet.completed),
        notes: typeof storedSet.notes === "string" ? storedSet.notes : set.notes,
        rir: isFiniteNumber(storedSet.rir) ? storedSet.rir : undefined,
        weight: isFiniteNumber(storedSet.weight) ? storedSet.weight : undefined,
      }
    })

    // Re-append sets the user added during the session that aren't in the API response
    const baseSetIds = new Set(exercise.sets.map((s) => s.id))
    const lastSet = exercise.sets[exercise.sets.length - 1]
    const sessionAddedSets: Workout["exercises"][number]["sets"] = storedExercise.sets
      .filter((storedSet) => !baseSetIds.has(storedSet.id))
      .map((storedSet, i) => ({
        id: storedSet.id,
        setNumber: exercise.sets.length + i + 1,
        targetReps: lastSet?.targetReps ?? 10,
        targetRepsMin: lastSet?.targetRepsMin,
        actualReps: isFiniteNumber(storedSet.actualReps) ? storedSet.actualReps : undefined,
        completed: Boolean(storedSet.completed),
        notes: typeof storedSet.notes === "string" ? storedSet.notes : undefined,
        rir: isFiniteNumber(storedSet.rir) ? storedSet.rir : undefined,
        weight: isFiniteNumber(storedSet.weight) ? storedSet.weight : undefined,
      }))

    return {
      ...exercise,
      sets: [...restoredSets, ...sessionAddedSets],
    }
  })
}

function restoreWorkoutSessionStartTime(startedAt: string) {
  const parsedTime = new Date(startedAt)
  return Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime
}

function getRecentDays(): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days: Date[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    days.push(day)
  }
  return days
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function resolvePlannedDateForWorkout(workout: Workout, actualDate: Date) {
  if (workout.scheduledDate) {
    return formatDateInputValue(workout.scheduledDate)
  }

  if (typeof workout.scheduledDay === "number") {
    const plannedDate = new Date(actualDate)
    plannedDate.setHours(0, 0, 0, 0)
    const dayOffset = (plannedDate.getDay() - workout.scheduledDay + 7) % 7
    plannedDate.setDate(plannedDate.getDate() - dayOffset)
    return formatDateInputValue(plannedDate)
  }

  return formatDateInputValue(actualDate)
}

function getDayLabel(date: Date, messages: AppMessages, locale: string): { primary: string; secondary?: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))
  const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
  if (diff === 0) return { primary: messages.workoutPage.today, secondary: dateStr }
  if (diff === 1) return { primary: messages.workoutPage.yesterdayDate, secondary: dateStr }
  return {
    primary: new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { weekday: "long" }).format(date),
    secondary: dateStr,
  }
}

// ─── Set row (Lift spec) ───────────────────────────────────────────────────────

interface LiftSetRowProps {
  set: ExerciseSet
  setIndex: number
  weightUnit: "kg" | "lbs"
  canRemove: boolean
  onToggle: (data: Partial<ExerciseSet>) => void
  onChange: (patch: Partial<ExerciseSet>) => void
  onRemove: () => void
}

function LiftSetRow({ set, setIndex, weightUnit, canRemove, onToggle, onChange, onRemove }: LiftSetRowProps) {
  const { messages } = useLocale()
  const [weight, setWeight] = useState(set.weight?.toString() ?? "")
  const [reps, setReps] = useState(set.actualReps?.toString() ?? set.targetReps.toString())
  const [rir, setRir] = useState(set.rir?.toString() ?? "")
  const [completed, setCompleted] = useState(set.completed)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(set.notes ?? "")

  useEffect(() => {
    setWeight(set.weight?.toString() ?? "")
  }, [set.id, set.weight])

  const handleToggle = () => {
    const next = !completed
    setCompleted(next)
    onToggle({
      completed: next,
      weight: Number.parseFloat(weight) || undefined,
      actualReps: Number.parseInt(reps) || set.targetReps,
      rir: rir.trim() ? Number.parseInt(rir) : undefined,
    })
  }

  const prevLabel = set.previousPerformance
    ? `${set.previousPerformance.weight ?? "—"} × ${set.previousPerformance.reps ?? "—"}`
    : "— · —"

  // All screens: Set | Previous | kg | Reps | RIR | actions  (6 cols)
  return (
    <div className={cn(completed ? "bg-muted" : "bg-transparent")}>
      <div
        className={cn(
          "grid items-center",
          "grid-cols-[36px_1fr_1fr_1fr_1fr_54px] gap-2",
          "px-4 py-[10px] md:px-5",
          "transition-colors duration-[180ms]",
        )}
      >
        {/* Set number */}
        <span
          className={cn(
            "font-mono text-[15px] font-semibold text-center",
            completed ? "text-muted-foreground" : "text-foreground",
          )}
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          {setIndex + 1}
        </span>

        {/* Previous */}
        <span className="text-[11px] text-muted-foreground font-mono text-center leading-tight" style={{ fontFeatureSettings: '"tnum" 1' }}>
          {prevLabel}
        </span>

      {/* Weight input */}
      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={(e) => {
          setWeight(e.target.value)
          onChange({ weight: Number.parseFloat(e.target.value) || undefined })
        }}
        placeholder="—"
        aria-label={messages.workoutPage.weightInUnit(weightUnit)}
        className={cn(
          "w-full font-mono text-[14px] text-center rounded-md",
          "border transition-colors duration-[180ms]",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "h-8 px-1",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          completed
            ? "border-transparent bg-transparent text-muted-foreground"
            : "border-border bg-background text-foreground",
        )}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      />

      {/* Reps input */}
      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => {
          setReps(e.target.value)
          onChange({ actualReps: Number.parseInt(e.target.value) || undefined })
        }}
        placeholder="—"
        aria-label={messages.workoutPage.reps}
        className={cn(
          "w-full font-mono text-[14px] text-center rounded-md",
          "border transition-colors duration-[180ms]",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "h-8 px-1",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          completed
            ? "border-transparent bg-transparent text-muted-foreground"
            : "border-border bg-background text-foreground",
        )}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      />

      {/* RIR input */}
      <input
        type="number"
        inputMode="numeric"
        value={rir}
        onChange={(e) => {
          setRir(e.target.value)
          onChange({ rir: e.target.value.trim() ? Number.parseInt(e.target.value) : undefined })
        }}
        placeholder={set.rir != null ? String(set.rir) : "—"}
        aria-label="RIR"
        min={0}
        max={10}
        className={cn(
          "w-full font-mono text-[14px] text-center rounded-md",
          "border transition-colors duration-[180ms]",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "h-8 px-1",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          completed
            ? "border-transparent bg-transparent text-muted-foreground"
            : "border-border bg-background text-foreground",
        )}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      />

        {/* Row actions: tick + more options */}
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={handleToggle}
            aria-label={completed ? messages.workoutPage.markIncomplete : messages.workoutPage.completeSet}
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-[4px]",
              "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(.2,.7,.2,1)]",
              completed
                ? "bg-[var(--success)] border-0"
                : "border-[1.5px] border-border bg-transparent",
            )}
          >
            {completed && <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={messages.workoutPage.setOptions}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setNoteOpen((v) => !v)}>
                <FileText className="mr-2 h-4 w-4" />
                {noteOpen ? messages.workoutPage.hideNote : messages.workoutPage.addNote}
                {note.trim() && !noteOpen && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
              {canRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onRemove}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {messages.workoutPage.removeSet}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Set note (inline, collapsible) */}
      {noteOpen && (
        <div className="px-4 pb-2 md:px-5">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              onChange({ notes: e.target.value || undefined })
            }}
            placeholder={messages.workoutPage.noteForSet}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
    </div>
  )
}

// ─── Exercise block (Lift spec) ────────────────────────────────────────────────

interface LiftExerciseBlockProps {
  exercise: WorkoutExercise
  weightUnit: "kg" | "lbs"
  onSetUpdate: (setId: string, patch: Partial<ExerciseSet>) => void
  onSetComplete: (exercise: WorkoutExercise, set: ExerciseSet, data: Partial<ExerciseSet>) => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
  onRemoveExercise: (exerciseId: string) => void
  onExerciseNoteChange: (exerciseId: string, note: string) => void
}

function LiftExerciseBlock({
  exercise,
  weightUnit,
  onSetUpdate,
  onSetComplete,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onExerciseNoteChange,
}: LiftExerciseBlockProps) {
  const { messages } = useLocale()
  const completedCount = exercise.sets.filter((s) => s.completed).length
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(exercise.notes ?? "")
  const exerciseLabel = formatExerciseVariationLabel({
    exerciseName: exercise.exercise.name,
    isDefault: exercise.variation.isDefault,
    variationName: exercise.variation.name,
  })

  return (
    <div className="border border-border rounded-[10px] bg-card overflow-hidden mb-4">
      {/* Block header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4 md:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight truncate">{exerciseLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {messages.workoutPage.setCount(exercise.sets.length)}
            {completedCount > 0 && ` · ${messages.workoutPage.setCompleted(completedCount)}`}
            {note.trim() && ` · 📝`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={messages.workoutPage.moreOptions}
              className="ml-2 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setNoteOpen((v) => !v)}>
              <FileText className="mr-2 h-4 w-4" />
              {noteOpen ? messages.workoutPage.hideNote : messages.workoutPage.addNote}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onRemoveExercise(exercise.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {messages.workoutPage.removeExercise}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Exercise note */}
      {noteOpen && (
        <div className="border-b border-border px-4 py-3 md:px-5">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              onExerciseNoteChange(exercise.id, e.target.value)
            }}
            placeholder={messages.workoutPage.noteForExercise}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Column headers */}
      <div
        className={cn(
          "grid items-center border-b border-border",
          "grid-cols-[36px_1fr_1fr_1fr_1fr_54px] gap-2",
          "px-4 py-2 md:px-5",
          "font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground",
        )}
      >
        <span className="text-center">{messages.workoutPage.set}</span>
        <span className="text-center">{messages.workoutPage.previous}</span>
        <span className="text-center">{weightUnit}</span>
        <span className="text-center">{messages.workoutPage.reps}</span>
        <span className="text-center">RIR</span>
        <span />
      </div>

      {/* Set rows */}
      {exercise.sets.map((set, idx) => (
        <LiftSetRow
          key={set.id}
          set={set}
          setIndex={idx}
          weightUnit={weightUnit}
          canRemove={exercise.sets.length > 1}
          onToggle={(data) => {
            onSetUpdate(set.id, data)
            if (data.completed) {
              onSetComplete(exercise, set, data)
            }
          }}
          onChange={(patch) => onSetUpdate(set.id, patch)}
          onRemove={() => onRemoveSet(exercise.id, set.id)}
        />
      ))}

      {/* Add set */}
      <button
        type="button"
        onClick={() => onAddSet(exercise.id)}
        className="flex w-full items-center gap-1.5 px-4 py-[10px] text-[13px] font-medium text-primary hover:bg-muted/60 transition-colors border-t border-border"
      >
        <Plus className="h-3.5 w-3.5" />
        {messages.workoutPage.addSet}
      </button>
    </div>
  )
}

// ─── Session stats card (Lift spec) ───────────────────────────────────────────

interface StatCellProps {
  label: string
  value: string | number
  sub: string
  /** Hide right border on last cell */
  last?: boolean
  /** In mobile 2×2, bottom row cells don't need bottom border */
  lastRow?: boolean
}

function StatCell({ label, value, sub, last, lastRow }: StatCellProps) {
  return (
    <div
      className={cn(
        "p-4",
        !last && "border-r border-border",
        !lastRow && "border-b border-border md:border-b-0",
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
        {label}
      </p>
      <p
        className="font-mono text-[22px] font-medium leading-none text-foreground"
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoutStartPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, profile, session } = useAuth()
  const { locale, messages } = useLocale()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Workout["exercises"]>([])
  const [startTime, setStartTime] = useState(new Date())
  const [now, setNow] = useState(new Date())
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDateDialog, setShowDateDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [restEvent, setRestEvent] = useState<RestEvent>(null)
  // Add exercise dialog
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseVariationOption[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id
  const weightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  // ── Load workout ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.access_token || !workoutId) {
      if (!authLoading) setIsLoading(false)
      return
    }

    let cancelled = false
    const loadWorkout = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const nextWorkout = await fetchWorkoutDetail(session.access_token, workoutId)
        if (cancelled) return
        const storedSession = readStoredWorkoutSession(workoutId)
        setWorkout(nextWorkout)
        setExercises(
          storedSession
            ? restoreWorkoutSessionExercises(nextWorkout.exercises, storedSession.exercises)
            : nextWorkout.exercises,
        )
        setCurrentExerciseIndex(
          storedSession
            ? Math.min(Math.max(0, storedSession.currentExerciseIndex), Math.max(0, nextWorkout.exercises.length - 1))
            : 0,
        )
        setStartTime(storedSession ? restoreWorkoutSessionStartTime(storedSession.startedAt) : new Date())
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : messages.workoutPage.loadingWorkout)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadWorkout()
    return () => { cancelled = true }
  }, [authLoading, session?.access_token, workoutId])

  // ── Timer: update elapsed every 30s ────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // ── Persist session to localStorage ────────────────────────────────────────
  useEffect(() => {
    if (!workout || !workoutId) return
    const storageKey = getWorkoutSessionStorageKey(workoutId)
    if (!hasSessionProgress(exercises)) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(createStoredWorkoutSession(exercises, startTime, currentExerciseIndex)),
    )
  }, [currentExerciseIndex, exercises, startTime, workout, workoutId])

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0,
  )
  const volume = exercises.reduce(
    (acc, ex) =>
      acc +
      ex.sets
        .filter((s) => s.completed)
        .reduce((a, s) => a + (s.weight ?? 0) * (s.actualReps ?? s.targetReps), 0),
    0,
  )
  const elapsedMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000))
  const elapsedLabel = elapsedMinutes < 60
    ? `${elapsedMinutes} ${messages.dashboard.min}`
    : `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`

  const startedLabel = (() => {
    const h = startTime.getHours()
    const m = startTime.getMinutes()
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  })()

  const dateLabel = (() => {
    return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
      day: "numeric",
      month: "long",
      weekday: "long",
    }).format(now)
  })()

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSetUpdate = (exerciseId: string, setId: string, patch: Partial<ExerciseSet>) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const updatedSetIndex = ex.sets.findIndex((set) => set.id === setId)
        const shouldSyncWeightToFollowingSets =
          updatedSetIndex >= 0 &&
          Object.prototype.hasOwnProperty.call(patch, "weight")

        return {
          ...ex,
          sets: ex.sets.map((set, index) => {
            if (set.id === setId) {
              return { ...set, ...patch }
            }

            if (
              shouldSyncWeightToFollowingSets &&
              index > updatedSetIndex &&
              !set.completed
            ) {
              return { ...set, weight: patch.weight }
            }

            return set
          }),
        }
      }),
    )
  }

  const handleRemoveExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId))
  }

  const handleExerciseNoteChange = (exerciseId: string, note: string) => {
    setExercises((prev) =>
      prev.map((ex) => ex.id === exerciseId ? { ...ex, notes: note || undefined } : ex),
    )
  }

  const handleOpenAddExercise = async () => {
    setShowAddExercise(true)
    if (exerciseLibrary.length > 0 || !session?.access_token) return
    setLoadingLibrary(true)
    try {
      const list = await fetchExercises(session.access_token)
      setExerciseLibrary(list)
    } catch {
      // non-critical — user sees empty list
    } finally {
      setLoadingLibrary(false)
    }
  }

  const handleAddExercise = (variation: ExerciseVariationOption) => {
    const id = `added-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newExercise: WorkoutExercise = {
      id,
      exercise: { id: variation.exerciseId, muscleGroup: variation.muscleGroup, name: variation.exerciseName },
      variation: { id: variation.id, isDefault: variation.isDefault, name: variation.variationName, equipment: variation.equipment, sortOrder: variation.sortOrder },
      sets: Array.from({ length: 3 }, (_, i) => ({
        id: `${id}-s${i}`,
        completed: false,
        setNumber: i + 1,
        targetReps: 10,
      })),
    }
    setExercises((prev) => [...prev, newExercise])
    setShowAddExercise(false)
  }

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId || ex.sets.length <= 1) return ex
        const nextSets = ex.sets
          .filter((set) => set.id !== setId)
          .map((set, index) => ({ ...set, setNumber: index + 1 }))

        return nextSets.length === ex.sets.length ? ex : { ...ex, sets: nextSets }
      }),
    )
  }

  const handleSetComplete = (
    exercise: WorkoutExercise,
    set: ExerciseSet,
    data: Partial<ExerciseSet>,
  ) => {
    if (data.completed) {
      const exerciseLabel = formatExerciseVariationLabel({
        exerciseName: exercise.exercise.name,
        isDefault: exercise.variation.isDefault,
        variationName: exercise.variation.name,
      })
      setRestEvent({
        duration: exercise.restTime ?? undefined,
        exercise: exerciseLabel,
        set: {
          id: set.id,
          kg: data.weight ?? set.weight ?? 0,
          reps: data.actualReps ?? set.actualReps ?? null,
        },
      })

      // Advance current exercise index if all sets on this exercise are done
      const updatedSets = exercise.sets.map((s) => (s.id === set.id ? { ...s, ...data } : s))
      if (updatedSets.every((s) => s.completed)) {
        const exIdx = exercises.findIndex((e) => e.id === exercise.id)
        if (exIdx >= 0 && exIdx < exercises.length - 1) {
          setCurrentExerciseIndex(exIdx + 1)
        }
      }
    }
  }

  const handleAddSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const last = ex.sets[ex.sets.length - 1]
        const newSet: ExerciseSet = {
          id: Math.random().toString(36).slice(2),
          setNumber: ex.sets.length + 1,
          targetReps: last?.targetReps ?? 10,
          actualReps: undefined,
          weight: last?.weight,
          completed: false,
        }
        return { ...ex, sets: [...ex.sets, newSet] }
      }),
    )
  }

  const performSave = async (logDate: Date = new Date()) => {
    if (!session?.access_token || !workout) return
    setIsSaving(true)
    setError(null)
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    const selectedMidnight = new Date(logDate)
    selectedMidnight.setHours(0, 0, 0, 0)
    const dayDiff = Math.round((todayMidnight.getTime() - selectedMidnight.getTime()) / (24 * 60 * 60 * 1000))
    const loggedStartedAt = new Date(startTime.getTime() - dayDiff * 24 * 60 * 60 * 1000)
    const loggedCompletedAt = new Date(Date.now() - dayDiff * 24 * 60 * 60 * 1000)
    try {
      await createWorkoutLog(session.access_token, workout.id, {
        completedAt: loggedCompletedAt.toISOString(),
        exercises,
        plannedDate: resolvePlannedDateForWorkout(workout, loggedStartedAt),
        startedAt: loggedStartedAt.toISOString(),
      })
      markDashboardForRefresh()
      window.localStorage.removeItem(getWorkoutSessionStorageKey(workout.id))
      router.push("/dashboard")
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : messages.meals.logMealError)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinishWorkout = () => {
    if (!workout) return
    const today = new Date()
    const isToday =
      (workout.scheduledDay !== undefined && workout.scheduledDay === today.getDay()) ||
      (workout.scheduledDate !== undefined &&
        workout.scheduledDate.getFullYear() === today.getFullYear() &&
        workout.scheduledDate.getMonth() === today.getMonth() &&
        workout.scheduledDate.getDate() === today.getDate())
    if (isToday) {
      void performSave(new Date())
      return
    }
    const defaultLogDate = new Date(today)
    defaultLogDate.setHours(0, 0, 0, 0)
    setSelectedDate(defaultLogDate)
    setShowDateDialog(true)
  }

  const handleCancelWorkout = () => {
    if (workout?.id) {
      window.localStorage.removeItem(getWorkoutSessionStorageKey(workout.id))
    }

    router.back()
  }

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
        {messages.workoutPage.loadingWorkout}
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">{messages.workoutPage.workoutNotFound}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || messages.workoutPage.thisWorkoutUnavailable}
          </p>
          <Button className="mt-4" onClick={() => router.push("/workout")}>
            {messages.workoutPage.backToWorkouts}
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[880px] px-4 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:px-10 md:pt-8">
        {/* Header */}
        <div className="mb-7">
          {/* Mobile back button */}
          <button
            type="button"
            onClick={handleCancelWorkout}
            className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
            {messages.workoutPage.cancelWorkout}
          </button>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">
            {dateLabel}
          </p>
          <h1 className="text-[28px] md:text-[40px] font-semibold tracking-[-0.02em] text-foreground m-0 leading-tight">
            {workout.name}
          </h1>
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-[10px] bg-card overflow-hidden mb-7">
          <StatCell
            label={messages.workoutPage.started}
            value={startedLabel}
            sub={elapsedLabel}
            lastRow={false}
          />
          <StatCell
            label={messages.workoutPage.set}
            value={`${completedSets} / ${totalSets}`}
            sub={messages.workoutPage.completed}
            last
            lastRow={false}
          />
          <StatCell
            label={messages.workoutPage.volume}
            value={volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : String(Math.round(volume))}
            sub={messages.workoutPage.kgLifted}
            lastRow
          />
          <StatCell
            label={messages.workoutPage.exercises}
            value={exercises.length}
            sub={messages.workoutPage.planned}
            last
            lastRow
          />
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}

        {/* Exercise blocks */}
        {exercises.map((exercise) => (
          <LiftExerciseBlock
            key={exercise.id}
            exercise={exercise}
            weightUnit={weightUnit}
            onSetUpdate={(setId, patch) => handleSetUpdate(exercise.id, setId, patch)}
            onSetComplete={(ex, set, data) => handleSetComplete(ex, set, data)}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onRemoveExercise={handleRemoveExercise}
            onExerciseNoteChange={handleExerciseNoteChange}
          />
        ))}

        {/* Bottom action bar */}
        <div className="mt-6 flex flex-col gap-2 md:flex-row md:gap-3">
          {/* Add exercise */}
          <Button
            variant="outline"
            className="w-full md:w-auto gap-1.5"
            onClick={() => void handleOpenAddExercise()}
          >
            <Plus className="h-4 w-4" />
            {messages.workoutPage.addExercise}
          </Button>

          {/* Spacer (desktop) */}
          <div className="hidden md:flex flex-1" />

          {/* Cancel (desktop only) */}
          <Button
            variant="ghost"
            className="hidden md:flex"
            onClick={handleCancelWorkout}
          >
            {messages.common.cancel}
          </Button>

          {/* Finish workout */}
          <Button
            className="w-full md:w-auto bg-foreground text-background hover:bg-foreground/90 font-semibold"
            onClick={handleFinishWorkout}
            disabled={completedSets === 0 || isSaving}
          >
            {isSaving ? messages.workoutPage.saving : messages.workoutPage.finishWorkout}
          </Button>
        </div>
      </main>

      {/* ── Rest Timer overlay ────────────────────────────────────────────── */}
      <RestTimer
        event={restEvent}
        onDismiss={() => setRestEvent(null)}
        defaultDuration={90}
      />

      {/* ── Date selection dialog ─────────────────────────────────────────── */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{messages.workoutPage.actualWorkoutDateTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-1">
            {getRecentDays()
              .slice()
              .reverse()
              .map((day) => {
                const { primary, secondary } = getDayLabel(day, messages, locale)
                const isSelected =
                  selectedDate.getFullYear() === day.getFullYear() &&
                  selectedDate.getMonth() === day.getMonth() &&
                  selectedDate.getDate() === day.getDate()

                return (
                  <button
                    key={day.toDateString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        isSelected ? "border-primary" : "border-muted-foreground",
                      )}
                    >
                      {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="font-medium">{primary}</span>
                    {secondary && (
                      <span className="ml-auto text-sm text-muted-foreground">{secondary}</span>
                    )}
                  </button>
                )
              })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)} disabled={isSaving}>
              {messages.common.cancel}
            </Button>
            <Button
              onClick={() => {
                setShowDateDialog(false)
                void performSave(selectedDate)
              }}
              disabled={isSaving}
            >
              {isSaving ? messages.common.saving : messages.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Exercise dialog ───────────────────────────────────────────── */}
      {showAddExercise ? (
        <AddExerciseModal
          exercises={exerciseLibrary}
          loading={loadingLibrary}
          existingVariationIds={exercises.map((ex) => ex.variation.id)}
          onPick={handleAddExercise}
          onClose={() => setShowAddExercise(false)}
        />
      ) : null}
    </div>
  )
}
