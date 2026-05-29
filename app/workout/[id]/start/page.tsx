"use client"

import {
  Check,
  MoreHorizontal,
  Plus,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RestTimer, type RestEvent } from "@/components/workout/rest-timer"
import { createWorkoutLog, fetchWorkoutDetail } from "@/lib/fitness/api"
import { markDashboardForRefresh } from "@/lib/fitness/dashboard-refresh"
import { cn } from "@/lib/utils"
import type { ExerciseSet, WorkoutExercise, Workout } from "@/lib/types"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"

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
    return {
      ...exercise,
      sets: exercise.sets.map((set) => {
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
      }),
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

function getDayLabel(date: Date): { primary: string; secondary?: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))
  const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
  const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
  if (diff === 0) return { primary: "Hôm nay", secondary: dateStr }
  if (diff === 1) return { primary: "Hôm qua", secondary: dateStr }
  return { primary: dayNames[date.getDay()], secondary: dateStr }
}

// ─── Set row (Lift spec) ───────────────────────────────────────────────────────

interface LiftSetRowProps {
  set: ExerciseSet
  setIndex: number
  weightUnit: "kg" | "lbs"
  onToggle: (data: Partial<ExerciseSet>) => void
  onChange: (patch: Partial<ExerciseSet>) => void
}

function LiftSetRow({ set, setIndex, weightUnit, onToggle, onChange }: LiftSetRowProps) {
  const [weight, setWeight] = useState(set.weight?.toString() ?? "")
  const [reps, setReps] = useState(set.actualReps?.toString() ?? set.targetReps.toString())
  const [completed, setCompleted] = useState(set.completed)

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
    })
  }

  const prevLabel = set.previousPerformance
    ? `${set.previousPerformance.weight ?? "—"} × ${set.previousPerformance.reps ?? "—"}`
    : "— · —"

  // Desktop: Set | Type | Previous | kg | Reps | ✓  (6 cols)
  // Mobile:  Set | Type | kg | Reps | ✓            (5 cols, no Previous)
  return (
    <div
      className={cn(
        "grid items-center border-b border-border last:border-0",
        // desktop 6-col, mobile 5-col
        "grid-cols-[36px_50px_1fr_1fr_32px] gap-2",
        "md:grid-cols-[56px_70px_1fr_92px_92px_32px] md:gap-3",
        "px-3 py-[10px] md:px-4",
        "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(.2,.7,.2,1)]",
        completed ? "bg-muted" : "bg-transparent",
      )}
    >
      {/* Set number */}
      <span
        className={cn(
          "font-mono text-[15px] font-semibold",
          completed ? "text-muted-foreground" : "text-foreground",
        )}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        {setIndex + 1}
      </span>

      {/* Type tag */}
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.08em]",
          set.setNumber === 0 || (set as ExerciseSet & { kind?: string }).kind === "warm"
            ? "text-muted-foreground"
            : completed
              ? "text-muted-foreground"
              : "text-foreground/70",
        )}
      >
        {setIndex === 0 ? "warm" : "work"}
      </span>

      {/* Previous (desktop only) */}
      <span className="hidden md:block text-[13px] text-muted-foreground font-mono" style={{ fontFeatureSettings: '"tnum" 1' }}>
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
        aria-label={`Weight in ${weightUnit}`}
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
        aria-label="Reps"
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

      {/* Complete checkbox */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={completed ? "Mark incomplete" : "Complete set"}
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
}

function LiftExerciseBlock({
  exercise,
  weightUnit,
  onSetUpdate,
  onSetComplete,
  onAddSet,
}: LiftExerciseBlockProps) {
  const completedCount = exercise.sets.filter((s) => s.completed).length
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
            {exercise.sets.length} set{exercise.sets.length !== 1 ? "s" : ""}
            {completedCount > 0 && ` · ${completedCount} completed`}
          </p>
        </div>
        <button
          type="button"
          aria-label="More options"
          className="ml-2 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Column headers */}
      <div
        className={cn(
          "grid items-center border-b border-border",
          "grid-cols-[36px_50px_1fr_1fr_32px] gap-2",
          "md:grid-cols-[56px_70px_1fr_92px_92px_32px] md:gap-3",
          "px-3 py-2 md:px-4",
          "font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground",
        )}
      >
        <span>Set</span>
        <span>Type</span>
        <span className="hidden md:block">Previous</span>
        <span>{weightUnit}</span>
        <span>Reps</span>
        <span />
      </div>

      {/* Set rows */}
      {exercise.sets.map((set, idx) => (
        <LiftSetRow
          key={set.id}
          set={set}
          setIndex={idx}
          weightUnit={weightUnit}
          onToggle={(data) => {
            onSetUpdate(set.id, data)
            if (data.completed) {
              onSetComplete(exercise, set, data)
            }
          }}
          onChange={(patch) => onSetUpdate(set.id, patch)}
        />
      ))}

      {/* Add set */}
      <button
        type="button"
        onClick={() => onAddSet(exercise.id)}
        className="flex w-full items-center gap-1.5 px-4 py-[10px] text-[13px] font-medium text-primary hover:bg-muted/60 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add set
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

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Workout["exercises"]>([])
  const [startTime, setStartTime] = useState(new Date())
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDateDialog, setShowDateDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    return yesterday
  })
  const [restEvent, setRestEvent] = useState<RestEvent>(null)

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
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Không thể tải workout.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadWorkout()
    return () => { cancelled = true }
  }, [authLoading, session?.access_token, workoutId])

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
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTime.getTime()) / 60000))

  const startedLabel = (() => {
    const h = startTime.getHours()
    const m = startTime.getMinutes()
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  })()

  const dateLabel = (() => {
    const now = new Date()
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ]
    return `${weekdays[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`
  })()

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSetUpdate = (exerciseId: string, setId: string, patch: Partial<ExerciseSet>) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const updatedSetIndex = ex.sets.findIndex((set) => set.id === setId)
        const shouldSyncWeightToFollowingSets =
          updatedSetIndex === 0 &&
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
              !set.completed &&
              set.weight == null
            ) {
              return { ...set, weight: patch.weight }
            }

            return set
          }),
        }
      }),
    )
  }

  const handleSetComplete = (
    exercise: WorkoutExercise,
    set: ExerciseSet,
    data: Partial<ExerciseSet>,
  ) => {
    if (data.completed) {
      setRestEvent({
        exercise: formatExerciseVariationLabel({
          exerciseName: exercise.exercise.name,
          isDefault: exercise.variation.isDefault,
          variationName: exercise.variation.name,
        }),
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
    try {
      await createWorkoutLog(session.access_token, workout.id, {
        completedAt: new Date().toISOString(),
        exercises,
        startedAt: loggedStartedAt.toISOString(),
      })
      markDashboardForRefresh()
      window.localStorage.removeItem(getWorkoutSessionStorageKey(workout.id))
      router.push("/dashboard")
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu workout log.")
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
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    setSelectedDate(yesterday)
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
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading workout...
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Workout not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "This workout is unavailable or not assigned to you."}
          </p>
          <Button className="mt-4" onClick={() => router.push("/workout")}>
            Back to workouts
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[880px] px-4 pt-5 pb-30 md:px-10 md:pt-8">
        {/* Header */}
        <div className="mb-7">
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
            label="Started"
            value={startedLabel}
            sub={`${elapsedMinutes} min ago`}
            lastRow={false}
          />
          <StatCell
            label="Sets"
            value={`${completedSets} / ${totalSets}`}
            sub="completed"
            last
            lastRow={false}
          />
          <StatCell
            label="Volume"
            value={volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : String(Math.round(volume))}
            sub="kg lifted"
            lastRow
          />
          <StatCell
            label="Exercises"
            value={exercises.length}
            sub="planned"
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
          />
        ))}

        {/* Bottom action bar */}
        <div className="mt-6 flex flex-col gap-2 md:flex-row md:gap-3">
          {/* Add exercise */}
          <Button
            variant="outline"
            className="w-full md:w-auto gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>

          {/* Spacer (desktop) */}
          <div className="hidden md:flex flex-1" />

          {/* Cancel (desktop only) */}
          <Button
            variant="ghost"
            className="hidden md:flex"
            onClick={handleCancelWorkout}
          >
            Cancel
          </Button>

          {/* Finish workout */}
          <Button
            className="w-full md:w-auto bg-foreground text-background hover:bg-foreground/90 font-semibold"
            onClick={handleFinishWorkout}
            disabled={completedSets === 0 || isSaving}
          >
            {isSaving ? "Saving..." : "Finish workout"}
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
            <DialogTitle>Bạn thực sự tập lúc nào?</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-1">
            {getRecentDays()
              .slice()
              .reverse()
              .map((day) => {
                const { primary, secondary } = getDayLabel(day)
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
              Hủy
            </Button>
            <Button
              onClick={() => {
                setShowDateDialog(false)
                void performSave(selectedDate)
              }}
              disabled={isSaving}
            >
              {isSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
