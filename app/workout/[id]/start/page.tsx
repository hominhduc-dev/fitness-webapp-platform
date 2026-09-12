"use client"

import {
  ArrowDownNarrowWide,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  MoreHorizontal,
  Plus,
  Repeat,
  Search,
  Trash2,
  TrendingUp,
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
import { ExerciseAnimation } from "@/components/workout/exercise-animation"
import { useCreateWorkoutLog, useSwapWorkoutExercise, useWorkoutDetail } from "@/lib/queries/workouts"
import { useExercises } from "@/lib/queries/exercises"
import { cn } from "@/lib/utils"
import type { CoachUpdate, CompoundSet, CompoundSetType, ExerciseSet, ExerciseVariationOption, WorkoutExercise, Workout } from "@/lib/types"
import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { AppMessages } from "@/lib/i18n/messages"
import { formatRepTarget } from "@/lib/workout-reps"
import {
  WORKOUT_SESSION_STORAGE_SCHEMA_VERSION,
  clearStoredWorkoutSession,
  getWorkoutSessionStorageKey,
  readStoredWorkoutSession,
  type StoredWorkoutSession,
} from "@/lib/workout/session-storage"
import type { SwapWorkoutExerciseResponse } from "@/lib/fitness/api"

// ─── Session storage helpers (see @/lib/workout/session-storage) ──────────────

/** Fallback rest duration (seconds) when an exercise has no `restTime` set. */
const DEFAULT_REST_SECONDS = 90
// The trailing column holds the complete-set tick and the row menu; both keep
// their 22px footprint and grow only in height on touch.
// Prev carries the longest string in the row ("82.5×8-10") while kg, Reps and
// RIR never hold more than a few digits, so on phones the width is weighted
// towards Prev rather than split evenly — otherwise the target rep range is the
// part that gets truncated away.
const SET_ROW_GRID_CLASS =
  "grid-cols-[26px_minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.7fr)_46px] gap-1 px-2 sm:grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_54px] sm:gap-2 sm:px-4 md:px-5"

type ProgramSetTarget = {
  reps: number
  repsMin?: number
  weight?: number
}

type CompoundSetMeta = {
  badge: string
  label: string
  shortLabel: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function createCompoundSegmentId() {
  return `segment-${Math.random().toString(36).slice(2)}`
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function sumCompoundReps(compoundSet?: CompoundSet) {
  return compoundSet?.segments.reduce((sum, segment) => sum + (segment.reps ?? 0), 0) ?? 0
}

function getCompoundSetVolume(set: ExerciseSet) {
  if (!set.compoundSet) return (set.weight ?? 0) * (set.actualReps ?? set.targetReps)
  return set.compoundSet.segments.reduce(
    (sum, segment) => sum + (segment.weight ?? set.weight ?? 0) * (segment.reps ?? 0),
    0,
  )
}

function getCompoundSummary(compoundSet: CompoundSet, fallbackWeight?: number) {
  const repsSummary = compoundSet.segments.map((segment) => segment.reps ?? "—").join("+")
  if (compoundSet.type === "drop_set") {
    return compoundSet.segments
      .map((segment) => `${segment.weight ?? fallbackWeight ?? "—"}×${segment.reps ?? "—"}`)
      .join(" → ")
  }
  if (compoundSet.type === "cluster") {
    const restLabel = compoundSet.restSec != null ? ` · ${compoundSet.restSec}s` : ""
    return `${compoundSet.segments.length}×${compoundSet.segments[0]?.reps ?? "—"}${restLabel}`
  }
  return `${repsSummary} = ${sumCompoundReps(compoundSet)}`
}

function getCompoundProgress(compoundSet: CompoundSet) {
  const total = sumCompoundReps(compoundSet)
  if (!compoundSet.targetReps) return `${total}`
  return `${total}/${compoundSet.targetReps}`
}

function createDefaultCompoundSet(type: CompoundSetType, set: ExerciseSet): CompoundSet {
  const baseWeight = set.weight ?? set.previousPerformance?.weight
  const baseReps = set.actualReps ?? set.targetReps
  const restSec = type === "cluster" ? 20 : 15

  if (type === "drop_set") {
    return {
      segments: [
        { id: createCompoundSegmentId(), reps: baseReps, weight: baseWeight },
        { id: createCompoundSegmentId(), reps: undefined, weight: baseWeight != null ? Math.max(0, Math.round(baseWeight * 0.8)) : undefined },
        { id: createCompoundSegmentId(), reps: undefined, weight: baseWeight != null ? Math.max(0, Math.round(baseWeight * 0.65)) : undefined },
      ],
      type,
    }
  }

  if (type === "cluster") {
    return {
      restSec,
      segments: Array.from({ length: 4 }, () => ({ id: createCompoundSegmentId(), reps: 2, weight: baseWeight })),
      targetReps: 8,
      type,
    }
  }

  return {
    restSec,
    segments: [{ id: createCompoundSegmentId(), reps: baseReps, weight: baseWeight }],
    targetReps: baseReps,
    type,
  }
}

function isGeneratedHistorySetId(exerciseId: string, setId: string) {
  return setId.startsWith(`${exerciseId}-xtra-`)
}

function buildProgramSetTargetMap(exercises: Workout["exercises"]) {
  const targets = new Map<string, ProgramSetTarget>()

  exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      targets.set(set.id, {
        reps: set.targetReps,
        repsMin: set.targetRepsMin,
        weight: set.weight,
      })
    })
  })

  return targets
}

function buildStoredAddedSetTokenMap(storedSession: StoredWorkoutSession | null) {
  if (storedSession?.schemaVersion !== WORKOUT_SESSION_STORAGE_SCHEMA_VERSION) {
    return new Map<string, string>()
  }

  const tokens = new Map<string, string>()

  storedSession.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      if (set.addedDuringSession === true && typeof set.clientAddedToken === "string" && set.clientAddedToken.trim()) {
        tokens.set(set.id, set.clientAddedToken)
      }
    })
  })

  return tokens
}

function hasSessionProgress(exercises: Workout["exercises"]) {
  return exercises.some((exercise) =>
    exercise.sets.some(
      (set) =>
        set.completed ||
        set.compoundSet != null ||
        set.weight != null ||
        set.actualReps != null ||
        set.notes?.trim() ||
        set.rir != null,
    ),
  )
}

function createStoredWorkoutSession(
  exercises: Workout["exercises"],
  startedAt: Date,
  currentExerciseIndex: number,
  addedSetTokens: ReadonlyMap<string, string>,
  workoutName: string,
): StoredWorkoutSession {
  return {
    currentExerciseIndex,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      sets: exercise.sets.map((set) => ({
        actualReps: set.actualReps,
        addedDuringSession: addedSetTokens.has(set.id),
        clientAddedToken: addedSetTokens.get(set.id),
        completed: set.completed,
        compoundSet: set.compoundSet,
        id: set.id,
        notes: set.notes,
        rir: set.rir,
        weight: set.weight,
      })),
    })),
    schemaVersion: WORKOUT_SESSION_STORAGE_SCHEMA_VERSION,
    startedAt: startedAt.toISOString(),
    workoutName,
  }
}

function restoreWorkoutSessionExercises(
  baseExercises: Workout["exercises"],
  storedExercises: StoredWorkoutSession["exercises"],
  canRestoreAddedSets: boolean,
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
        compoundSet: storedSet.compoundSet,
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
      .filter(
        (storedSet) =>
          !baseSetIds.has(storedSet.id) &&
          canRestoreAddedSets &&
          storedSet.addedDuringSession === true &&
          typeof storedSet.clientAddedToken === "string" &&
          storedSet.clientAddedToken.trim().length > 0 &&
          !isGeneratedHistorySetId(exercise.id, storedSet.id),
      )
      .map((storedSet, i) => ({
        id: storedSet.id,
        setNumber: exercise.sets.length + i + 1,
        targetReps: lastSet?.targetReps ?? 10,
        targetRepsMin: lastSet?.targetRepsMin,
        actualReps: isFiniteNumber(storedSet.actualReps) ? storedSet.actualReps : undefined,
        compoundSet: storedSet.compoundSet,
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

// On a fresh workout load (no in-progress session in localStorage), pre-fill each
// set's weight/reps/RIR from the trainee's last logged performance (same program,
// see backend scope filter). If the coach just adjusted the exercise's target
// (`coachUpdate` present), respect the new target instead — those numbers are
// the coach's fresh instruction, not stale prev data.
function seedFromPreviousPerformance(exercises: Workout["exercises"]) {
  return exercises.map((exercise) => {
    if (exercise.coachUpdate) return exercise
    return {
      ...exercise,
      sets: exercise.sets.map((set) => {
        const pp = set.previousPerformance
        if (!pp) return set
        return {
          ...set,
          weight: pp.weight ?? set.weight,
          actualReps: set.actualReps ?? pp.reps,
          rir: pp.rir ?? set.rir,
        }
      }),
    }
  })
}

function restoreWorkoutSessionStartTime(startedAt: string) {
  const parsedTime = new Date(startedAt)
  return Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime
}

// The "actual workout date" picker defaults to the workout's planned occurrence in the
// past week (this week's Wed for a Wed workout finished on Fri), so accepting the
// default lands the log on the same cell the workout was scheduled for. Falls back to
// today when the workout isn't recurring, isn't tied to a specific date, or its
// planned date is still in the future.
function resolveDefaultFinishLogDate(workout: Workout, todayMidnight: Date): Date {
  if (workout.scheduledDate) {
    const scheduled = new Date(workout.scheduledDate)
    scheduled.setHours(0, 0, 0, 0)
    return scheduled.getTime() <= todayMidnight.getTime() ? scheduled : todayMidnight
  }
  if (typeof workout.scheduledDay === "number") {
    const target = new Date(todayMidnight)
    const dayOffset = (target.getDay() - workout.scheduledDay + 7) % 7
    if (dayOffset === 0) return target
    target.setDate(target.getDate() - dayOffset)
    return target
  }
  return todayMidnight
}

// After a coach-program fork, every workoutExercise and set gets a fresh UUID.
// Re-key the stored session under the new workoutId and remap each exercise/set
// id via the server-provided mapping; unmapped ids (e.g. sets the user added
// mid-session, or exercises from a workout that wasn't the current one) fall
// through unchanged.
function migrateStoredWorkoutSession(oldWorkoutId: string, response: SwapWorkoutExerciseResponse) {
  if (typeof window === "undefined") return
  const stored = readStoredWorkoutSession(oldWorkoutId)
  if (!stored) return
  const exerciseIdMap = response.currentWorkoutExerciseIdMap
  const setIdMap = response.currentSetIdMap
  const migrated: StoredWorkoutSession = {
    ...stored,
    exercises: stored.exercises.map((exercise) => ({
      ...exercise,
      id: exerciseIdMap[exercise.id] ?? exercise.id,
      sets: exercise.sets.map((set) => ({
        ...set,
        id: setIdMap[set.id] ?? set.id,
      })),
    })),
  }
  window.localStorage.setItem(
    getWorkoutSessionStorageKey(response.workoutId),
    JSON.stringify(migrated),
  )
  clearStoredWorkoutSession(oldWorkoutId)
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

/** Parses a `yyyy-MM-dd` query value into a local-midnight Date, or null if invalid. */
function parseLogDateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function resolvePlannedDateForWorkout(workout: Workout, actualDate: Date) {
  if (workout.scheduledDate) {
    return formatDateInputValue(workout.scheduledDate)
  }

  if (typeof workout.scheduledDay === "number") {
    // Snap plannedDate to the SAME Mon–Sun week as actualDate. Doing Day 3 (Wed)
    // on Monday counts as this week's Wed, not last week's — catch-up scenarios
    // used to land plannedDate in the previous week and cause the recurring cell
    // in the current week to appear as a duplicate to-do.
    const anchor = new Date(actualDate)
    anchor.setHours(0, 0, 0, 0)
    const daysFromMonday = (anchor.getDay() + 6) % 7
    const plannedDate = new Date(anchor)
    plannedDate.setDate(anchor.getDate() - daysFromMonday + ((workout.scheduledDay + 6) % 7))
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
  programTarget?: ProgramSetTarget
  set: ExerciseSet
  setIndex: number
  weightUnit: "kg" | "lbs"
  canRemove: boolean
  onToggle: (data: Partial<ExerciseSet>) => void
  onChange: (patch: Partial<ExerciseSet>) => void
  onRemove: () => void
}

function LiftSetRow({ programTarget, set, setIndex, weightUnit, canRemove, onToggle, onChange, onRemove }: LiftSetRowProps) {
  const { messages } = useLocale()
  const [weight, setWeight] = useState(set.weight?.toString() ?? "")
  const [reps, setReps] = useState((set.actualReps ?? set.targetReps).toString())
  const [rir, setRir] = useState(set.rir?.toString() ?? "")
  const [completed, setCompleted] = useState(set.completed)
  const [noteOpen, setNoteOpen] = useState(false)
  const [compoundOpen, setCompoundOpen] = useState(false)
  const [note, setNote] = useState(set.notes ?? "")
  const previousSetIdRef = useRef(set.id)

  useEffect(() => {
    setWeight(set.weight?.toString() ?? "")
  }, [set.id, set.weight])

  useEffect(() => {
    if (previousSetIdRef.current !== set.id) {
      previousSetIdRef.current = set.id
      setReps((set.actualReps ?? set.targetReps).toString())
      return
    }

    if (set.actualReps != null) {
      setReps(set.actualReps.toString())
    }
  }, [set.actualReps, set.id, set.targetReps])

  useEffect(() => {
    setRir(set.rir?.toString() ?? "")
  }, [set.id, set.rir])

  const getCompoundMeta = (type: CompoundSetType): CompoundSetMeta => {
    switch (type) {
      case "drop_set":
        return { badge: "DROP", label: messages.workoutPage.compoundTypeDropSet, shortLabel: "Drop" }
      case "rest_pause":
        return { badge: "RP", label: messages.workoutPage.compoundTypeRestPause, shortLabel: "Rest-pause" }
      case "cluster":
        return { badge: "CLS", label: messages.workoutPage.compoundTypeCluster, shortLabel: "Cluster" }
      case "myo_rep_match":
      default:
        return { badge: "MRM", label: messages.workoutPage.compoundTypeMyoMatch, shortLabel: "Myo match" }
    }
  }

  const getCompoundDescription = (type: CompoundSetType) => {
    switch (type) {
      case "drop_set":
        return messages.workoutPage.compoundDropSetDescription
      case "rest_pause":
        return messages.workoutPage.compoundRestPauseDescription
      case "cluster":
        return messages.workoutPage.compoundClusterDescription
      case "myo_rep_match":
      default:
        return messages.workoutPage.compoundMyoMatchDescription
    }
  }

  const updateCompoundSet = (compoundSet: CompoundSet) => {
    const totalReps = sumCompoundReps(compoundSet)
    const firstWeight = compoundSet.segments.find((segment) => segment.weight != null)?.weight
    setReps(totalReps > 0 ? String(totalReps) : "")
    if (firstWeight != null) {
      setWeight(String(firstWeight))
    }
    onChange({
      actualReps: totalReps || undefined,
      compoundSet,
      weight: firstWeight ?? set.weight,
    })
  }

  const handleSetTypeSelect = (type: CompoundSetType | "normal") => {
    if (type === "normal") {
      setCompoundOpen(false)
      onChange({ compoundSet: undefined })
      return
    }
    const compoundSet = createDefaultCompoundSet(type, {
      ...set,
      actualReps: parsePositiveInteger(reps) ?? set.actualReps,
      weight: parsePositiveNumber(weight) ?? set.weight,
    })
    setCompoundOpen(true)
    updateCompoundSet(compoundSet)
  }

  const handleToggle = () => {
    const next = !completed
    const totalReps = sumCompoundReps(set.compoundSet)
    setCompleted(next)
    onToggle({
      completed: next,
      weight: Number.parseFloat(weight) || undefined,
      actualReps: totalReps || Number.parseInt(reps) || set.targetReps,
      rir: rir.trim() ? Number.parseInt(rir) : undefined,
    })
  }

  // Prev column mixes two sources: weight from the trainee's last logged set of
  // this exercise in the same program, and reps from the coach's programmed rep
  // range for this program. Weight shows progression; the range shows today's
  // target. Each side falls back to the other source when one is missing.
  const prevWeight = set.previousPerformance?.weight ?? programTarget?.weight
  const repsPart = programTarget
    ? formatRepTarget({ reps: programTarget.reps, repsMin: programTarget.repsMin })
    : set.previousPerformance?.reps != null
      ? String(set.previousPerformance.reps)
      : null
  const weightPart = prevWeight != null ? String(prevWeight) : null
  // No spaces around the "×": at 375px the two of them are the difference
  // between showing the target rep range and truncating it away.
  const prevLabel =
    weightPart || repsPart ? `${weightPart ?? "—"}×${repsPart ?? "—"}` : "— · —"
  // Passive progression hint: if last session's reps exceeded the coach's upper
  // bound, tint the cell green and append a ↗ so trainee sees they've earned a
  // weight bump. No auto-adjustment — trainee decides.
  const exceededRange =
    set.previousPerformance?.reps != null &&
    programTarget?.reps != null &&
    set.previousPerformance.reps > programTarget.reps
  const compoundMeta = set.compoundSet ? getCompoundMeta(set.compoundSet.type) : null
  const displayedReps = set.compoundSet ? (sumCompoundReps(set.compoundSet) || "") : reps

  // All screens: Set | Previous | kg | Reps | RIR | actions  (6 cols)
  return (
    <div className={cn(completed ? "bg-muted" : set.compoundSet ? "bg-primary-soft/30" : "bg-transparent")}>
      <div
        className={cn(
          "grid min-w-0 items-center",
          SET_ROW_GRID_CLASS,
          // The fields carry their own height on touch, so the row padding backs
          // off to keep the list from stretching out.
          "py-[10px] pointer-coarse:py-1",
          "transition-colors duration-[180ms]",
        )}
      >
        {/* Set number + method badge */}
        {set.compoundSet && compoundMeta ? (
          <button
            type="button"
            onClick={() => setCompoundOpen((value) => !value)}
            aria-label={`${compoundMeta.label} ${messages.workoutPage.set} ${setIndex + 1}`}
            aria-expanded={compoundOpen}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center"
          >
            <span
              className={cn(
                "font-mono text-base font-semibold leading-none",
                completed ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {setIndex + 1}
            </span>
            <span className="rounded-full bg-primary px-1.5 py-px font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-primary-foreground">
              {compoundMeta.badge}
            </span>
          </button>
        ) : (
          <span
            className={cn(
              "min-w-0 text-center font-mono text-base font-semibold",
              completed ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {setIndex + 1}
          </span>
        )}

        {/* Previous */}
        {set.compoundSet && compoundMeta ? (
          <button
            type="button"
            onClick={() => setCompoundOpen((value) => !value)}
            aria-expanded={compoundOpen}
            className="flex min-w-0 flex-col items-start justify-center gap-0.5 text-left"
          >
            <span className="max-w-full truncate text-xs font-semibold leading-tight text-foreground">
              {compoundMeta.shortLabel}
            </span>
            <span className="max-w-full truncate font-mono text-micro leading-tight text-muted-foreground">
              {getCompoundSummary(set.compoundSet, parsePositiveNumber(weight))}
            </span>
          </button>
        ) : (
          <span
            className={cn(
              "min-w-0 font-mono text-micro leading-tight",
              exceededRange
                ? "inline-flex items-center justify-center gap-1 text-success-text"
                : "block truncate text-center text-muted-foreground",
            )}
            title={exceededRange ? messages.workoutPage.prevExceededHint : undefined}
            aria-label={exceededRange ? `${prevLabel}. ${messages.workoutPage.prevExceededHint}` : undefined}
          >
            {exceededRange ? (
              <>
                <span className="truncate">{prevLabel}</span>
                <TrendingUp className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
              </>
            ) : (
              prevLabel
            )}
          </span>
        )}

      {/* Weight input */}
      <input
        type="number"
        inputMode="decimal"
        value={weight}
        disabled={completed}
        onChange={(e) => {
          setWeight(e.target.value)
          onChange({ weight: Number.parseFloat(e.target.value) || undefined })
        }}
        placeholder="—"
        aria-label={messages.workoutPage.weightInUnit(weightUnit)}
        className={cn(
          "min-w-0 w-full rounded-md pointer-coarse:rounded-lg text-center font-mono text-sm",
          "border transition-colors duration-[180ms]",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "h-8 pointer-coarse:h-11 px-1",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          "disabled:cursor-not-allowed",
          completed
            ? "border-transparent bg-transparent text-muted-foreground"
            // Touch needs a 44px box, but a 44px *outlined* box reads heavy in a
            // dense grid. Drop the border there and let a soft fill carry the
            // field instead — same target, much lighter on the eye.
            : "border-border bg-background text-foreground pointer-coarse:border-transparent pointer-coarse:bg-muted",
        )}
      />

      {/* Reps input */}
      <input
        type="number"
        inputMode="numeric"
        value={displayedReps}
        disabled={completed || Boolean(set.compoundSet)}
        onChange={(e) => {
          setReps(e.target.value)
          onChange({ actualReps: Number.parseInt(e.target.value) || undefined })
        }}
        placeholder="—"
        aria-label={messages.workoutPage.reps}
        className={cn(
          "min-w-0 w-full rounded-md pointer-coarse:rounded-lg text-center font-mono text-sm",
          "border transition-colors duration-[180ms]",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "h-8 pointer-coarse:h-11 px-1",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          "disabled:cursor-not-allowed",
          completed || set.compoundSet
            ? "border-transparent bg-transparent text-muted-foreground"
            // Touch needs a 44px box, but a 44px *outlined* box reads heavy in a
            // dense grid. Drop the border there and let a soft fill carry the
            // field instead — same target, much lighter on the eye.
            : "border-border bg-background text-foreground pointer-coarse:border-transparent pointer-coarse:bg-muted",
        )}
      />

      {/* RIR input */}
      <input
        type="number"
        inputMode="numeric"
        value={rir}
        disabled={completed}
        onChange={(e) => {
          setRir(e.target.value)
          onChange({ rir: e.target.value.trim() ? Number.parseInt(e.target.value) : undefined })
        }}
        placeholder={set.rir != null ? String(set.rir) : "—"}
        aria-label="RIR"
        min={0}
        max={10}
        className={cn(
          "min-w-0 w-full rounded-md pointer-coarse:rounded-lg text-center font-mono text-sm",
          "border transition-colors duration-[180ms]",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "h-8 pointer-coarse:h-11 px-1",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          "disabled:cursor-not-allowed",
          completed
            ? "border-transparent bg-transparent text-muted-foreground"
            // Touch needs a 44px box, but a 44px *outlined* box reads heavy in a
            // dense grid. Drop the border there and let a soft fill carry the
            // field instead — same target, much lighter on the eye.
            : "border-border bg-background text-foreground pointer-coarse:border-transparent pointer-coarse:bg-muted",
        )}
      />

        {/* Row actions: tick + more options */}
        <div className="flex items-center justify-end gap-1">
          {set.compoundSet && compoundMeta ? (
            <button
              type="button"
              onClick={() => setCompoundOpen((value) => !value)}
              aria-label={`${compoundMeta.label} details`}
              aria-expanded={compoundOpen}
              className="flex h-[22px] w-[18px] items-center justify-center pointer-coarse:h-11 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", compoundOpen && "rotate-180")} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleToggle}
            aria-label={completed ? messages.workoutPage.markIncomplete : messages.workoutPage.completeSet}
            // Completing a set is the most-tapped control in the app, and a 22px
            // square is half the platform minimum. Rather than inflate the box,
            // the button is just an invisible 44px-tall target and the inner
            // span keeps the original 22px tick — big to hit, small to look at.
            className="flex h-[22px] w-[22px] items-center justify-center pointer-coarse:h-11"
          >
            <span
              className={cn(
                "flex h-[22px] w-[22px] items-center justify-center rounded",
                "transition-all duration-[180ms] [transition-timing-function:cubic-bezier(.2,.7,.2,1)]",
                completed
                  ? "bg-[var(--success)] border-0"
                  : "border-[1.5px] border-border bg-transparent",
              )}
            >
              {completed && <Check className="h-3.5 w-3.5 text-success-foreground" strokeWidth={2.5} />}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={messages.workoutPage.setOptions}
                className="flex h-[22px] w-[22px] items-center justify-center pointer-coarse:h-11 text-muted-foreground transition-colors hover:text-foreground"
              >
                {/* Same split as the tick: tall invisible target, small visual. */}
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded transition-colors hover:bg-muted">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setNoteOpen((v) => !v)}>
                <FileText className="mr-2 h-4 w-4" />
                {noteOpen ? messages.workoutPage.hideNote : messages.workoutPage.addNote}
                {note.trim() && !noteOpen && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-xs font-medium text-muted-foreground">
                {messages.workoutPage.compoundSetMenuLabel}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetTypeSelect("normal")}>
                {messages.workoutPage.compoundNormalSet}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetTypeSelect("myo_rep_match")}>
                {messages.workoutPage.compoundTypeMyoMatch}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetTypeSelect("drop_set")}>
                {messages.workoutPage.compoundTypeDropSet}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetTypeSelect("rest_pause")}>
                {messages.workoutPage.compoundTypeRestPause}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetTypeSelect("cluster")}>
                {messages.workoutPage.compoundTypeCluster}
              </DropdownMenuItem>
              {canRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive-text focus:text-destructive-text"
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

      {set.compoundSet && compoundMeta && compoundOpen ? (
        <div className="border-t border-primary/20 bg-primary-soft/25 px-2 pb-2 pt-2 sm:px-4 md:px-5">
            <div className="rounded-xl border border-primary/20 bg-background p-3">
              <div className="mb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{compoundMeta.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{getCompoundDescription(set.compoundSet.type)}</p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                    {compoundMeta.badge}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {messages.workoutPage.compoundProgress(getCompoundProgress(set.compoundSet))}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {set.compoundSet.type !== "drop_set" ? (
                    <label className="space-y-1">
                      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                        {messages.workoutPage.compoundSetTarget}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.compoundSet.targetReps ?? ""}
                        onChange={(event) => updateCompoundSet({
                          ...set.compoundSet!,
                          targetReps: parsePositiveInteger(event.target.value),
                        })}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </label>
                  ) : null}
                  {set.compoundSet.type !== "drop_set" ? (
                    <label className="space-y-1">
                      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                        {messages.workoutPage.compoundMiniRest}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={set.compoundSet.restSec ?? ""}
                        onChange={(event) => updateCompoundSet({
                          ...set.compoundSet!,
                          restSec: parsePositiveInteger(event.target.value),
                        })}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                {set.compoundSet.segments.map((segment, segmentIndex) => (
                  <div key={segment.id} className="grid grid-cols-[minmax(0,1fr)_72px_72px_28px] items-end gap-2">
                    <label className="space-y-1">
                      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                        {messages.workoutPage.compoundSegment(segmentIndex + 1)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={segment.weight ?? ""}
                        onChange={(event) => {
                          const nextSegments = set.compoundSet!.segments.map((item) =>
                            item.id === segment.id ? { ...item, weight: parsePositiveNumber(event.target.value) } : item,
                          )
                          updateCompoundSet({ ...set.compoundSet!, segments: nextSegments })
                        }}
                        placeholder={weightUnit}
                        className="h-10 w-full rounded-md border border-border bg-background px-2 text-center font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                        {messages.workoutPage.reps}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={segment.reps ?? ""}
                        onChange={(event) => {
                          const nextSegments = set.compoundSet!.segments.map((item) =>
                            item.id === segment.id ? { ...item, reps: parsePositiveInteger(event.target.value) } : item,
                          )
                          updateCompoundSet({ ...set.compoundSet!, segments: nextSegments })
                        }}
                        className="h-10 w-full rounded-md border border-border bg-background px-2 text-center font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </label>
                    <div className="pb-2 text-center font-mono text-xs text-muted-foreground">
                      {segment.weight ?? parsePositiveNumber(weight) ?? "—"}×{segment.reps ?? "—"}
                    </div>
                    <button
                      type="button"
                      disabled={set.compoundSet!.segments.length <= 1}
                      onClick={() => {
                        const nextSegments = set.compoundSet!.segments.filter((item) => item.id !== segment.id)
                        updateCompoundSet({ ...set.compoundSet!, segments: nextSegments })
                      }}
                      aria-label={messages.workoutPage.removeSet}
                      className="mb-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-text disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{messages.workoutPage.compoundSetHelp}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => {
                    const inheritedWeight =
                      set.compoundSet!.type === "drop_set"
                        ? set.compoundSet!.segments.at(-1)?.weight
                        : parsePositiveNumber(weight)
                    updateCompoundSet({
                      ...set.compoundSet!,
                      segments: [
                        ...set.compoundSet!.segments,
                        { id: createCompoundSegmentId(), reps: undefined, weight: inheritedWeight },
                      ],
                    })
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {messages.workoutPage.compoundAddSegment}
                </Button>
              </div>
            </div>
        </div>
      ) : null}

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
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
    </div>
  )
}

function getCoachUpdateMeta(type: CoachUpdate["type"]) {
  switch (type) {
    case "weight_up":
      return {
        buttonBgClassName: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
        hoverClassName: "hover:bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
        icon: TrendingUp,
        panelBgClassName: "bg-[color-mix(in_srgb,var(--success)_8%,transparent)]",
        textClassName: "text-success-text",
      }
    case "rir_down":
    case "weight_down":
      return {
        buttonBgClassName: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]",
        hoverClassName: "hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]",
        icon: ArrowDownNarrowWide,
        panelBgClassName: "bg-[color-mix(in_srgb,var(--warning)_8%,transparent)]",
        textClassName: "text-warning-text",
      }
    case "rir_up":
    case "edit":
    default:
      return {
        buttonBgClassName: "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
        hoverClassName: "hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
        icon: Edit3,
        panelBgClassName: "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
        textClassName: "text-primary",
      }
  }
}

// ─── Exercise block (Lift spec) ────────────────────────────────────────────────

interface LiftExerciseBlockProps {
  exercise: WorkoutExercise
  programSetTargets: Map<string, ProgramSetTarget>
  weightUnit: "kg" | "lbs"
  isCurrent: boolean
  onSetUpdate: (setId: string, patch: Partial<ExerciseSet>) => void
  onSetComplete: (exercise: WorkoutExercise, set: ExerciseSet, data: Partial<ExerciseSet>) => void
  onCollapse?: () => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
  onRemoveExercise: (exerciseId: string) => void
  onRequestReplace: (exercise: WorkoutExercise) => void
  onExerciseNoteChange: (exerciseId: string, note: string) => void
}

function LiftExerciseBlock({
  exercise,
  programSetTargets,
  weightUnit,
  isCurrent,
  onSetUpdate,
  onSetComplete,
  onCollapse,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onRequestReplace,
  onExerciseNoteChange,
}: LiftExerciseBlockProps) {
  const { messages } = useLocale()
  const completedCount = exercise.sets.filter((s) => s.completed).length
  const allSetsCompleted = exercise.sets.length > 0 && completedCount === exercise.sets.length
  const [collapsed, setCollapsed] = useState(allSetsCompleted || !isCurrent)
  const [coachUpdateOpen, setCoachUpdateOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(exercise.notes ?? "")
  const hasRenderedRef = useRef(false)
  const onCollapseRef = useRef(onCollapse)
  const coachUpdate = exercise.coachUpdate
  const coachUpdateMeta = coachUpdate ? getCoachUpdateMeta(coachUpdate.type) : null
  const CoachUpdateIcon = coachUpdateMeta?.icon
  const exerciseLabel = formatExerciseVariationLabel({
    exerciseName: exercise.exercise.name,
    isDefault: exercise.variation.isDefault,
    variationName: exercise.variation.name,
  })

  useEffect(() => {
    onCollapseRef.current = onCollapse
  }, [onCollapse])

  useEffect(() => {
    if (allSetsCompleted) {
      setCollapsed(true)
      return
    }
    setCollapsed(!isCurrent)
  }, [allSetsCompleted, isCurrent])

  useEffect(() => {
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true
      return
    }

    if (!collapsed) return

    const frame = window.requestAnimationFrame(() => {
      onCollapseRef.current?.()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [collapsed])

  return (
    <div
      className={cn(
        "mb-4 min-w-0 overflow-hidden rounded-lg border transition-colors duration-[180ms]",
        allSetsCompleted
          ? "border-[color-mix(in_srgb,var(--success)_45%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
          : "border-border bg-card",
      )}
    >
      {/* Block header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4 md:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 line-clamp-2 text-base font-semibold leading-tight tracking-[0] text-foreground md:text-lg">{exerciseLabel}</p>
            {coachUpdate && coachUpdateMeta && CoachUpdateIcon ? (
              <button
                type="button"
                onClick={() => setCoachUpdateOpen((value) => !value)}
                aria-label="Coach update"
                aria-expanded={coachUpdateOpen}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded border-0 px-[7px] py-[3px]",
                  "font-mono text-micro font-semibold uppercase tracking-[0.07em]",
                  "transition-colors duration-150",
                  coachUpdateOpen ? coachUpdateMeta.buttonBgClassName : "bg-muted/60",
                  coachUpdateMeta.textClassName,
                  coachUpdateMeta.hoverClassName,
                )}
              >
                <CoachUpdateIcon className="h-[11px] w-[11px]" />
                <span>Coach</span>
                {coachUpdateOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {messages.workoutPage.setCount(exercise.sets.length)}
            {completedCount > 0 && ` · ${messages.workoutPage.setCompleted(completedCount)}`}
            {note.trim() && ` · 📝`}
          </p>
          {coachUpdate && coachUpdateOpen && coachUpdateMeta && CoachUpdateIcon ? (
            <div className={cn("mt-2 flex items-start gap-1.5 rounded-md px-2.5 py-[7px]", coachUpdateMeta.panelBgClassName)}>
              <CoachUpdateIcon className={cn("mt-px h-[13px] w-[13px] shrink-0", coachUpdateMeta.textClassName)} />
              <span className="text-xs leading-[1.4] text-foreground">{coachUpdate.text}</span>
            </div>
          ) : null}
        </div>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`${exercise.exercise.name} exercise`)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={messages.workoutPage.searchExercise}
          title={messages.workoutPage.searchExercise}
          className="ml-2 flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? messages.workoutPage.expandExercise : messages.workoutPage.collapseExercise}
          aria-expanded={!collapsed}
          className="ml-2 flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={messages.workoutPage.moreOptions}
              className="ml-2 flex shrink-0 items-center justify-center rounded-md p-1.5 pointer-coarse:size-11 text-muted-foreground hover:bg-muted transition-colors"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setNoteOpen((v) => !v)}>
              <FileText className="mr-2 h-4 w-4" />
              {noteOpen ? messages.workoutPage.hideNote : messages.workoutPage.addNote}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRequestReplace(exercise)}>
              <Repeat className="mr-2 h-4 w-4" />
              {messages.workoutPage.swapExercise}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive-text focus:text-destructive-text"
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
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {!collapsed && (
        <>
          {exercise.variation.media ? (
            <ExerciseAnimation exerciseName={exerciseLabel} media={exercise.variation.media} />
          ) : null}
          {/* Column headers */}
          <div
            className={cn(
              "grid min-w-0 items-center border-b border-border",
              SET_ROW_GRID_CLASS,
              "py-2",
              "font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground",
            )}
          >
            <span className="min-w-0 text-center">{messages.workoutPage.set}</span>
            <span className="min-w-0 truncate text-center">{messages.workoutPage.previous}</span>
            <span className="min-w-0 text-center">{weightUnit}</span>
            <span className="min-w-0 text-center">{messages.workoutPage.reps}</span>
            <span className="min-w-0 text-center">RIR</span>
            <span />
          </div>

          {/* Set rows */}
          {exercise.sets.map((set, idx) => (
            <LiftSetRow
              key={set.id}
              programTarget={programSetTargets.get(set.id)}
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
            className="flex w-full items-center gap-1.5 px-4 py-[10px] text-sm font-medium text-primary hover:bg-muted/60 transition-colors border-t border-border"
          >
            <Plus className="h-3.5 w-3.5" />
            {messages.workoutPage.addSet}
          </button>
        </>
      )}
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
        "min-w-0 p-4",
        !last && "border-r border-border",
        !lastRow && "border-b border-border md:border-b-0",
      )}
    >
      <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
        {label}
      </p>
      <p
        className="truncate font-mono text-2xl font-medium leading-none text-foreground"
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type SessionSeed = Workout & {
  originalExercises: Workout["exercises"]
  storedSession: ReturnType<typeof readStoredWorkoutSession>
}

function selectSessionSeed(workout: Workout): SessionSeed {
  const storedSession = readStoredWorkoutSession(workout.id)
  return {
    ...workout,
    originalExercises: workout.exercises,
    storedSession,
    exercises: storedSession
      ? restoreWorkoutSessionExercises(workout.exercises, storedSession.exercises,
          storedSession.schemaVersion === WORKOUT_SESSION_STORAGE_SCHEMA_VERSION)
      : seedFromPreviousPerformance(workout.exercises),
  }
}

export default function WorkoutStartPage() {
  const params = useParams()
  const { profile } = useAuth()
  return <WorkoutSession key={`${profile?.id ?? "anonymous"}:${params.id}`} />
}

function WorkoutSession() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, profile, session } = useAuth()
  const { locale, messages } = useLocale()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Workout["exercises"]>([])
  const [startTime, setStartTime] = useState(new Date())
  const [now, setNow] = useState(new Date())
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([])
  const shouldAutoScrollExerciseRef = useRef(false)
  const scrollResetWorkoutIdRef = useRef<string | null>(null)
  const addedSetTokensRef = useRef<Map<string, string>>(new Map())
  const programSetTargetsRef = useRef<Map<string, ProgramSetTarget>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDateDialog, setShowDateDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  // When opened from a past schedule cell (`?logDate=yyyy-MM-dd`), the log is saved
  // directly to that date on finish — bypassing the recent-days picker entirely.
  const [presetLogDate, setPresetLogDate] = useState<Date | null>(null)
  const [restEvent, setRestEvent] = useState<RestEvent>(null)
  // Add exercise dialog
  const [showAddExercise, setShowAddExercise] = useState(false)
  const libraryQuery = useExercises(undefined, undefined, showAddExercise)
  const exerciseLibrary = libraryQuery.data ?? []
  const loadingLibrary = libraryQuery.isFetching
  // Replace exercise dialog — tracks which exercise the trainee wants to swap.
  const [replacingExercise, setReplacingExercise] = useState<WorkoutExercise | null>(null)
  const replacementsQuery = useExercises(
    { muscleGroup: replacingExercise?.exercise.muscleGroup }, undefined, Boolean(replacingExercise))
  const replacementCandidates = replacementsQuery.data ?? []
  const loadingReplacements = replacementsQuery.isFetching
  const [swapInFlight, setSwapInFlight] = useState(false)

  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id
  const workoutQuery = useWorkoutDetail(workoutId ?? "", {
    activeSession: true, enabled: !workout, select: selectSessionSeed,
  })
  const isLoading = authLoading || (Boolean(profile) && !workout && !workoutQuery.isError)
  const logMutation = useCreateWorkoutLog()
  const swapMutation = useSwapWorkoutExercise()
  const weightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  // Reset after the workout replaces the loading state. Doing this earlier lets
  // Next.js scroll restoration reapply the dashboard's previous scroll offset.
  useEffect(() => {
    if (isLoading || !workout || !workoutId || scrollResetWorkoutIdRef.current === workoutId) return
    scrollResetWorkoutIdRef.current = workoutId

    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    resetScroll()
    const frameId = requestAnimationFrame(resetScroll)
    const timeoutId = window.setTimeout(resetScroll, 100)

    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [isLoading, workout, workoutId])

  // ── Load workout ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (workout || !workoutQuery.data) return
    const nextWorkout = workoutQuery.data as SessionSeed
    const storedSession = nextWorkout.storedSession
    addedSetTokensRef.current = buildStoredAddedSetTokenMap(storedSession)
    programSetTargetsRef.current = buildProgramSetTargetMap(nextWorkout.originalExercises)
    setWorkout(nextWorkout)
    setExercises(nextWorkout.exercises)
    setCurrentExerciseIndex(storedSession
      ? Math.min(Math.max(0, storedSession.currentExerciseIndex), Math.max(0, nextWorkout.exercises.length - 1)) : 0)
    setStartTime(storedSession ? restoreWorkoutSessionStartTime(storedSession.startedAt) : new Date())
  }, [workout, workoutQuery.data])

  // ── Timer: update elapsed every 30s ────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // ── Read `?logDate=` once on mount (back-logging a past session) ────────────
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("logDate")
    const parsed = parseLogDateParam(param)
    if (parsed) setPresetLogDate(parsed)
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
      JSON.stringify(createStoredWorkoutSession(
        exercises,
        startTime,
        currentExerciseIndex,
        addedSetTokensRef.current,
        workout.name,
      )),
    )
  }, [currentExerciseIndex, exercises, startTime, workout, workoutId])

  // ── Auto-advance: scroll the active exercise into view ─────────────────────
  useEffect(() => {
    if (!shouldAutoScrollExerciseRef.current) return
    shouldAutoScrollExerciseRef.current = false

    const frameId = requestAnimationFrame(() => {
      exerciseRefs.current[currentExerciseIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })

    return () => cancelAnimationFrame(frameId)
  }, [currentExerciseIndex])

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
        .reduce((a, s) => a + getCompoundSetVolume(s), 0),
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
    }).format(presetLogDate ?? now)
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

  const handleOpenAddExercise = () => {
    setShowAddExercise(true)
  }

  const handleAddExercise = (variation: ExerciseVariationOption) => {
    const id = `added-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newExercise: WorkoutExercise = {
      id,
      exercise: { id: variation.exerciseId, muscleGroup: variation.muscleGroup, name: variation.exerciseName },
      variation: {
        activityType: variation.activityType,
        equipment: variation.equipment,
        id: variation.id,
        isDefault: variation.isDefault,
        name: variation.variationName,
        primaryMuscles: variation.primaryMuscles,
        secondaryMuscles: variation.secondaryMuscles,
        sortOrder: variation.sortOrder,
      },
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

  const handleOpenReplace = (exercise: WorkoutExercise) => {
    setReplacingExercise(exercise)
  }

  const handleReplacePick = async (variation: ExerciseVariationOption) => {
    if (!replacingExercise || !session?.access_token || !workoutId) return
    if (variation.id === replacingExercise.variation.id) {
      setReplacingExercise(null)
      return
    }

    setSwapInFlight(true)
    setError(null)
    try {
      const response = await swapMutation.mutateAsync({
        workoutId, workoutExerciseId: replacingExercise.id, variationId: variation.id,
      })

      // On a coach-program fork every workoutExercise + set gets a fresh UUID;
      // remap in-memory state (and the in-progress addedSetTokens map) so the
      // persist effect writes the new IDs — otherwise the pre-remount save would
      // overwrite our migrated localStorage with stale old-IDs.
      const isForkedSwap = Boolean(response.forkedProgramId && response.workoutId !== workoutId)
      const exerciseIdMap = response.currentWorkoutExerciseIdMap
      const setIdMap = response.currentSetIdMap

      const patchExercise = (list: Workout["exercises"]) =>
        list.map((ex) => {
          const remappedExerciseId = isForkedSwap ? (exerciseIdMap[ex.id] ?? ex.id) : ex.id
          const remappedSets = isForkedSwap
            ? ex.sets.map((set) => ({ ...set, id: setIdMap[set.id] ?? set.id }))
            : ex.sets
          if (ex.id === replacingExercise.id) {
            return {
              ...ex,
              id: remappedExerciseId,
              sets: remappedSets,
              exercise: {
                id: variation.exerciseId,
                muscleGroup: variation.muscleGroup,
                name: variation.exerciseName,
              },
              variation: {
                activityType: variation.activityType,
                equipment: variation.equipment,
                id: variation.id,
                isDefault: variation.isDefault,
                name: variation.variationName,
                primaryMuscles: variation.primaryMuscles,
                secondaryMuscles: variation.secondaryMuscles,
                sortOrder: variation.sortOrder,
              },
            }
          }
          return { ...ex, id: remappedExerciseId, sets: remappedSets }
        })
      setExercises(patchExercise)
      setWorkout((prev) => (prev ? { ...prev, exercises: patchExercise(prev.exercises) } : prev))
      setReplacingExercise(null)

      if (isForkedSwap) {
        // Rewire client-added-set tokens under their new set IDs so restored sessions
        // can still tell "added mid-session" vs "part of the program".
        const nextTokens = new Map<string, string>()
        addedSetTokensRef.current.forEach((token, setId) => {
          nextTokens.set(setIdMap[setId] ?? setId, token)
        })
        addedSetTokensRef.current = nextTokens

        // Migrate the in-progress localStorage session under the new workoutId with
        // remapped exercise/set IDs so completed sets and entered weights survive
        // the redirect (and clear the old key so it doesn't linger).
        migrateStoredWorkoutSession(workoutId, response)
        router.replace(`/workout/${response.workoutId}/start`)
      }
    } catch (swapError) {
      setError(swapError instanceof Error ? swapError.message : "Không thể đổi bài tập.")
    } finally {
      setSwapInFlight(false)
    }
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
          kg: data.weight ?? set.weight ?? null,
          reps: data.actualReps ?? set.actualReps ?? null,
        },
      })

      // Advance current exercise index if all sets on this exercise are done
      const updatedSets = exercise.sets.map((s) => (s.id === set.id ? { ...s, ...data } : s))
      if (updatedSets.every((s) => s.completed)) {
        const exIdx = exercises.findIndex((e) => e.id === exercise.id)
        if (exIdx >= 0 && exIdx < exercises.length - 1) {
          shouldAutoScrollExerciseRef.current = true
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
        addedSetTokensRef.current.set(newSet.id, `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        return { ...ex, sets: [...ex.sets, newSet] }
      }),
    )
  }

  const performSave = async (logDate: Date = new Date()) => {
    if (!session?.access_token || !workout) return
    setIsSaving(true)
    setError(null)
    const selectedMidnight = new Date(logDate)
    selectedMidnight.setHours(0, 0, 0, 0)
    const startMidnight = new Date(startTime)
    startMidnight.setHours(0, 0, 0, 0)
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    // Only preserve the real startTime / now when the whole workflow (start + finish +
    // selected log date) is TODAY. In every other case anchor to noon UTC of the
    // selected local date. The schedule cell placement uses `formatUtcDateOnly(startedAt)`
    // server-side and `getDateKey(startedAt)` client-side; noon UTC is the only anchor
    // whose UTC and local calendar dates agree across common timezones (e.g. Wed 22:00
    // in a UTC-5 zone would otherwise be Thu UTC and land on the wrong cell, while the
    // Wed cell goes empty because completedOccurrenceKeys already claimed that slot).
    const isFinishingLiveToday =
      selectedMidnight.getTime() === todayMidnight.getTime() &&
      startMidnight.getTime() === todayMidnight.getTime()
    const loggedStartedAt = isFinishingLiveToday
      ? startTime
      : new Date(Date.UTC(
          selectedMidnight.getFullYear(),
          selectedMidnight.getMonth(),
          selectedMidnight.getDate(),
          12,
          0,
          0,
        ))
    const MAX_WORKOUT_DURATION_MS = 4 * 60 * 60 * 1000
    const rawElapsedMs = Math.max(60_000, Date.now() - startTime.getTime())
    const cappedElapsedMs = Math.min(rawElapsedMs, MAX_WORKOUT_DURATION_MS)
    const loggedCompletedAt = isFinishingLiveToday
      ? new Date()
      : new Date(loggedStartedAt.getTime() + cappedElapsedMs)
    try {
      await logMutation.mutateAsync({ workoutId: workout.id, input: {
        completedAt: loggedCompletedAt.toISOString(),
        exercises,
        plannedDate: resolvePlannedDateForWorkout(workout, loggedStartedAt),
        startedAt: loggedStartedAt.toISOString(),
      } })
      clearStoredWorkoutSession(workout.id)
      router.push("/dashboard")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : messages.meals.logMealError)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinishWorkout = () => {
    if (!workout) return
    if (presetLogDate) {
      void performSave(presetLogDate)
      return
    }
    const today = new Date()
    const todayMidnight = new Date(today)
    todayMidnight.setHours(0, 0, 0, 0)
    const startMidnight = new Date(startTime)
    startMidnight.setHours(0, 0, 0, 0)
    const startedBeforeToday = startMidnight.getTime() < todayMidnight.getTime()
    // Session resumed from a previous day (user forgot to finish) — the workout was done
    // on startTime's date, so log it there directly and skip the date picker.
    if (startedBeforeToday) {
      void performSave(startMidnight)
      return
    }
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
    // Not today: default the picker to the workout's planned date instead of today, so
    // just accepting the default lands the log on the scheduled day. Leaving it on today
    // would send startedAt=today and plannedDate=<scheduled day>, which removes the
    // scheduled day from the "remaining" list AND places the log on today's cell —
    // leaving the scheduled cell visibly empty.
    const defaultLogDate = resolveDefaultFinishLogDate(workout, todayMidnight)
    setSelectedDate(defaultLogDate)
    setShowDateDialog(true)
  }

  const handleCancelWorkout = () => {
    if (workout?.id) {
      clearStoredWorkoutSession(workout.id)
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
    <div className="min-h-[100dvh] overflow-x-hidden bg-background">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-[880px] min-w-0 px-3 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-4 md:px-10 md:pt-8">
        {/* Header */}
        <div className="mb-7">
          {/* Mobile back button */}
          <button
            type="button"
            onClick={handleCancelWorkout}
            className="mb-3 flex items-center gap-1.5 pointer-coarse:min-h-11 text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
            {messages.workoutPage.cancelWorkout}
          </button>
          <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground mb-2">
            {dateLabel}
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-foreground m-0 leading-tight">
            {workout.name}
          </h1>
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-lg bg-card overflow-hidden mb-7">
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
          <p className="mb-4 text-sm text-destructive-text">{error}</p>
        )}

        {/* Exercise blocks */}
        {exercises.map((exercise, index) => (
          <div
            key={exercise.id}
            ref={(el) => {
              exerciseRefs.current[index] = el
            }}
            style={{ scrollMarginTop: "1rem" }}
          >
            <LiftExerciseBlock
              exercise={exercise}
              programSetTargets={programSetTargetsRef.current}
              weightUnit={weightUnit}
              isCurrent={index === currentExerciseIndex}
              onSetUpdate={(setId, patch) => handleSetUpdate(exercise.id, setId, patch)}
              onSetComplete={(ex, set, data) => handleSetComplete(ex, set, data)}
              onCollapse={() => {
                exerciseRefs.current[index + 1]?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }}
              onAddSet={handleAddSet}
              onRemoveSet={handleRemoveSet}
              onRemoveExercise={handleRemoveExercise}
              onRequestReplace={handleOpenReplace}
              onExerciseNoteChange={handleExerciseNoteChange}
            />
          </div>
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
        defaultDuration={DEFAULT_REST_SECONDS}
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

      {/* ── Replace Exercise dialog ────────────────────────────────────────
         Picker filtered to same muscle group. On pick, `handleReplacePick`
         calls the swap API — if the workout belongs to a coach's program,
         the backend forks the program for this trainee and returns the new
         workout id, which we redirect to. */}
      {replacingExercise ? (
        <AddExerciseModal
          exercises={replacementCandidates}
          loading={loadingReplacements || swapInFlight}
          currentVariationId={replacingExercise.variation.id}
          existingVariationIds={exercises
            .filter((ex) => ex.id !== replacingExercise.id)
            .map((ex) => ex.variation.id)}
          title={messages.workoutPage.swapExercise}
          onPick={(pick) => { void handleReplacePick(pick) }}
          onClose={() => { if (!swapInFlight) setReplacingExercise(null) }}
        />
      ) : null}
    </div>
  )
}
