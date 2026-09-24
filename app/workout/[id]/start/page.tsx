"use client"

import {
  ArrowDownNarrowWide,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  MoreHorizontal,
  Plus,
  Repeat,
  Search,
  Sparkles,
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
import { SlideToConfirm } from "@/components/workout/slide-to-confirm"
import { SyncStatusBadge } from "@/components/offline/sync-status-badge"
import { ApiError } from "@/lib/auth/api"
import {
  createClientLogId,
  getUnsyncedWorkoutSessionDraft,
  queueWorkoutLog,
  queueWorkoutSessionDraft,
  queueWorkoutSessionDraftDelete,
} from "@/lib/offline/workout-log-queue"
import {
  deleteOfflineWorkoutSnapshot,
  getOfflineWorkoutSnapshot,
  saveOfflineWorkoutSnapshot,
} from "@/lib/offline/workout-snapshot"
import { warmOfflineWorkoutRoute } from "@/lib/offline/service-worker"
import {
  useCreateWorkoutLog,
  useDuplicateWorkoutToRoutine,
  useSwapWorkoutExercise,
  useWorkoutDetail,
  useWorkoutSessionDraft,
} from "@/lib/queries/workouts"
import { useExercises } from "@/lib/queries/exercises"
import { useSetVolumeRecommendationStatus, useVolumeRecovery } from "@/lib/queries/progress"
import { acceptedCoachHints, coachHintForExercise, type CoachHint } from "@/lib/fitness/coach-hints"
import { cn } from "@/lib/utils"
import type { CoachUpdate, ExerciseSet, ExerciseVariationOption, WorkoutExercise, Workout } from "@/lib/types"
import { IntensityTagBadge, getIntensityTagLabel } from "@/components/workout/set-intensity-tag"
import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { AppMessages } from "@/lib/i18n/messages"
import { formatRepTarget } from "@/lib/workout-reps"
import {
  WORKOUT_SESSION_STORAGE_SCHEMA_VERSION,
  clearStoredWorkoutSession,
  getWorkoutSessionStorageKey,
  pickNewerStoredWorkoutSession,
  readStoredWorkoutSession,
  type StoredWorkoutSession,
} from "@/lib/workout/session-storage"
import { markWorkoutCelebration } from "@/lib/workout/celebration"
import type { SwapWorkoutExerciseResponse } from "@/lib/fitness/api"
import { restoreWorkoutSessionExercises } from "@/lib/workout/restore-session"
import { nextExerciseCollapsed } from "@/lib/workout/exercise-collapse"
import { isExerciseDone, nextIncompleteExercise, sessionDisplayOrder } from "@/lib/workout/exercise-order"

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
  deletedSetIds: ReadonlySet<string>,
): StoredWorkoutSession {
  return {
    deletedSetIds: [...deletedSetIds],
    currentExerciseIndex,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      sets: exercise.sets.map((set) => ({
        actualReps: set.actualReps,
        addedDuringSession: addedSetTokens.has(set.id),
        clientAddedToken: addedSetTokens.get(set.id),
        completed: set.completed,
        id: set.id,
        notes: set.notes,
        rir: set.rir,
        weight: set.weight,
      })),
    })),
    schemaVersion: WORKOUT_SESSION_STORAGE_SCHEMA_VERSION,
    startedAt: startedAt.toISOString(),
    updatedAt: new Date().toISOString(),
    workoutName,
  }
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
    // Not synced under the new workout id yet; keeping the marker would make the new
    // page treat the missing server draft as "discarded on another device".
    syncedAt: undefined,
    deletedSetIds: stored.deletedSetIds?.map((id) => setIdMap[id] ?? id),
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
  // All screens: Set | Previous | kg | Reps | RIR | actions  (6 cols)
  return (
    <div data-tour="session-set" className={cn(completed ? "bg-muted" : "bg-transparent")}>
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
        {/* Set number, with the method the coach prescribed for this set */}
        {set.intensityTag ? (
          <span
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center"
            title={getIntensityTagLabel(set.intensityTag, messages)}
            aria-label={messages.workoutPage.intensitySetMethodLabel(
              setIndex + 1,
              getIntensityTagLabel(set.intensityTag, messages),
            )}
          >
            <span
              className={cn(
                "font-mono text-base font-semibold leading-none",
                completed ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {setIndex + 1}
            </span>
            <IntensityTagBadge tag={set.intensityTag} />
          </span>
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
        value={reps}
        disabled={completed}
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
          completed
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
                  ? "border-0 bg-primary"
                  : "border-[1.5px] border-border bg-transparent",
              )}
            >
              {/* The tick has to move with the fill: --success-foreground is a
                  near-black green, which is not a contrast pair for the brand
                  colour underneath it. */}
              {completed && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />}
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
  coachHint: CoachHint | null
  onApplyCoachHint: (hint: CoachHint, exerciseId: string) => void
  programSetTargets: Map<string, ProgramSetTarget>
  weightUnit: "kg" | "lbs"
  isCurrent: boolean
  onSetUpdate: (setId: string, patch: Partial<ExerciseSet>) => void
  onSetComplete: (exercise: WorkoutExercise, set: ExerciseSet, data: Partial<ExerciseSet>) => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
  onRemoveExercise: (exerciseId: string) => void
  onRequestReplace: (exercise: WorkoutExercise) => void
  onExerciseNoteChange: (exerciseId: string, note: string) => void
}

function LiftExerciseBlock({
  exercise,
  coachHint,
  onApplyCoachHint,
  programSetTargets,
  weightUnit,
  isCurrent,
  onSetUpdate,
  onSetComplete,
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
  const wasCompletedRef = useRef(allSetsCompleted)
  const [coachUpdateOpen, setCoachUpdateOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(exercise.notes ?? "")
  const coachUpdate = exercise.coachUpdate
  const coachUpdateMeta = coachUpdate ? getCoachUpdateMeta(coachUpdate.type) : null
  const CoachUpdateIcon = coachUpdateMeta?.icon
  const exerciseLabel = formatExerciseVariationLabel({
    displayName: exercise.variation.displayName,
    exerciseName: exercise.exercise.name,
    isDefault: exercise.variation.isDefault,
    variationName: exercise.variation.name,
  })
  const volumeCopy = messages.volumeRecovery
  const coachHintText = coachHint
    ? volumeCopy.sessionHint(
        coachHint.action,
        volumeCopy.muscleLabels[coachHint.muscleSlug as keyof typeof volumeCopy.muscleLabels] ?? coachHint.muscleSlug,
        coachHint.currentSets,
        coachHint.recommendedSets,
      )
    : null

  useEffect(() => {
    const nextCollapsed = nextExerciseCollapsed(wasCompletedRef.current, allSetsCompleted, isCurrent)
    wasCompletedRef.current = allSetsCompleted
    if (nextCollapsed !== undefined) setCollapsed(nextCollapsed)
  }, [allSetsCompleted, isCurrent])

  return (
    <div
      data-tour="session-exercise"
      className={cn(
        "mb-4 min-w-0 overflow-hidden rounded-lg border transition-colors duration-[180ms]",
        // Done follows the active palette rather than a fixed green: a finished
        // block is progress through this workout, not a system "success", and
        // the screen already spends green on the coach-update chips, where it
        // does mean something specific.
        allSetsCompleted
          ? "border-[color-mix(in_srgb,var(--primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
          : "border-border bg-card",
      )}
    >
      {/* Block header: title and actions on one row, then any hint across the
          full card width so it wraps once instead of squeezing beside the icons. */}
      <div className="border-b border-border px-4 py-3.5 md:px-5">
        <div className="flex items-center justify-between">
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
        {coachUpdate && coachUpdateOpen && coachUpdateMeta && CoachUpdateIcon ? (
          <div className={cn("mt-2 flex items-start gap-1.5 rounded-md px-2.5 py-[7px]", coachUpdateMeta.panelBgClassName)}>
            <CoachUpdateIcon className={cn("mt-px h-[13px] w-[13px] shrink-0", coachUpdateMeta.textClassName)} />
            <span className="text-xs leading-[1.4] text-foreground">{coachUpdate.text}</span>
          </div>
        ) : null}
        {/* Volume recommendation the trainee accepted, shown on the exercise
            that actually drives that muscle's volume. */}
        {coachHint && coachHintText ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md bg-primary-soft px-2.5 py-[7px]">
            <Sparkles className="h-[13px] w-[13px] shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-xs leading-[1.4] text-foreground">{coachHintText}</span>
            {coachHint.action === "increase" ? (
              <button
                type="button"
                onClick={() => onApplyCoachHint(coachHint, exercise.id)}
                className={cn(
                  "shrink-0 rounded border-0 bg-primary px-2 py-1 text-primary-foreground",
                  "font-mono text-micro font-semibold uppercase tracking-[0.07em]",
                  "transition-opacity hover:opacity-90",
                )}
              >
                {volumeCopy.addTheSet}
              </button>
            ) : null}
          </div>
        ) : null}
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
}

function StatCell({ label, value, sub }: StatCellProps) {
  return (
    <div className="min-w-0 px-2.5 py-2.5 md:p-4">
      <p className="truncate font-mono text-micro uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-base font-medium leading-none text-foreground md:mt-1.5 md:text-2xl">
        {value}
      </p>
      <p className="mt-1 truncate text-micro text-muted-foreground md:text-xs">{sub}</p>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type SessionSeed = Workout & {
  originalExercises: Workout["exercises"]
}

function buildSessionSeed(workout: Workout, storedSession: StoredWorkoutSession | null): SessionSeed {
  return {
    ...workout,
    originalExercises: workout.exercises,
    exercises: storedSession
      ? restoreWorkoutSessionExercises(workout.exercises, storedSession.exercises,
          storedSession.schemaVersion === WORKOUT_SESSION_STORAGE_SCHEMA_VERSION, storedSession.deletedSetIds)
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
  // Set once the session is finished, cancelled or moved to a forked workout.
  const sessionRetiredRef = useRef(false)
  const addedSetTokensRef = useRef<Map<string, string>>(new Map())
  const deletedSetIdsRef = useRef<Set<string>>(new Set())
  const programSetTargetsRef = useRef<Map<string, ProgramSetTarget>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDateDialog, setShowDateDialog] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
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
  // Recommendations accepted on the dashboard, surfaced here on the exercises
  // that actually drive each muscle's volume.
  const volumeRecoveryQuery = useVolumeRecovery()
  const answerRecommendation = useSetVolumeRecommendationStatus()
  // Drops a hint the moment it is acted on, so a slow refetch cannot leave the
  // button up long enough to add the set twice.
  const [appliedHintSlugs, setAppliedHintSlugs] = useState<string[]>([])
  const coachHints = acceptedCoachHints(volumeRecoveryQuery.data).filter(
    (hint) => !appliedHintSlugs.includes(hint.muscleSlug),
  )

  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id
  const userId = profile?.id ?? null
  // Full exercise/variation seed retained in IndexedDB for an offline restart.
  const [offlineWorkoutState, setOfflineWorkoutState] = useState<{
    workout: Workout | null
    workoutId: string
  } | null>(null)
  const offlineWorkout = offlineWorkoutState?.workoutId === workoutId
    ? offlineWorkoutState?.workout
    : undefined
  // Session state still waiting in the offline queue; `undefined` while reading.
  const [unsyncedDraftState, setUnsyncedDraftState] = useState<{
    draft: StoredWorkoutSession | "deleted" | null
    workoutId: string
  } | null>(null)
  const unsyncedDraft = unsyncedDraftState?.workoutId === workoutId
    ? unsyncedDraftState?.draft
    : undefined
  const workoutQuery = useWorkoutDetail(workoutId ?? "", {
    activeSession: true, enabled: !workout,
  })
  const draftQuery = useWorkoutSessionDraft(workoutId ?? "", {
    // An unsent local change is newer than anything the server holds.
    enabled: Boolean(profile) && Boolean(workoutId) && !workout && unsyncedDraft === null,
  })
  const workoutSeed = workoutQuery.data ?? offlineWorkout
  // A snapshot restored from storage refetches before seeding (see
  // useWorkoutDetail); offline that fetch pauses and the snapshot is used.
  const isRefreshingSeed = workoutQuery.fetchStatus === "fetching"
  const isOfflineWorkoutResolved = offlineWorkout !== undefined
  const isWorkoutUnavailableOffline =
    isOfflineWorkoutResolved && !workoutSeed && workoutQuery.isPending && workoutQuery.fetchStatus === "paused"
  const isDraftResolved =
    unsyncedDraft !== undefined &&
    (unsyncedDraft !== null || !draftQuery.isPending || draftQuery.fetchStatus === "paused")
  const isLoading =
    authLoading ||
    (Boolean(profile) && !workout && (!workoutQuery.isError && !draftQuery.isError) &&
      ((!workoutSeed && workoutQuery.isPending && !isWorkoutUnavailableOffline) ||
        isRefreshingSeed || !isOfflineWorkoutResolved || !isDraftResolved))
  const logMutation = useCreateWorkoutLog()
  const swapMutation = useSwapWorkoutExercise()
  const duplicateToRoutineMutation = useDuplicateWorkoutToRoutine()
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const weightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  useEffect(() => {
    if (!userId || !workoutId) return
    let cancelled = false
    getUnsyncedWorkoutSessionDraft(userId, workoutId)
      // No IndexedDB (blocked storage): fall back to the server and localStorage.
      .catch(() => null)
      .then((draft) => {
        if (!cancelled) setUnsyncedDraftState({ draft, workoutId })
      })
    return () => {
      cancelled = true
    }
  }, [userId, workoutId])

  useEffect(() => {
    if (!userId || !workoutId) return
    let cancelled = false
    getOfflineWorkoutSnapshot(userId, workoutId)
      .catch(() => null)
      .then((snapshot) => {
        if (!cancelled) setOfflineWorkoutState({ workout: snapshot, workoutId })
      })
    return () => {
      cancelled = true
    }
  }, [userId, workoutId])

  // Client-side navigation only requests an RSC payload, not a document that
  // the Service Worker can replay after iOS evicts the PWA from memory. Pin the
  // exact logger document as soon as the session opens, independently of the
  // dashboard's best-effort idle prefetch.
  useEffect(() => {
    if (!userId || !workoutId || navigator.onLine === false) return
    void warmOfflineWorkoutRoute(workoutId)
  }, [userId, workoutId])

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
    if (workout || !workoutSeed || isRefreshingSeed || !isDraftResolved) return
    // Unsent local state > server draft > this tab's localStorage mirror. The
    // mirror is written synchronously and the queued draft is not, so when both
    // describe this run the newer of the two wins rather than the queued one.
    const localMirror = workoutSeed.id ? readStoredWorkoutSession(workoutSeed.id) : null
    const storedSession = unsyncedDraft === "deleted"
      ? null
      : unsyncedDraft
        ? pickNewerStoredWorkoutSession(unsyncedDraft, localMirror)
        : draftQuery.data ?? localMirror
    const nextWorkout = buildSessionSeed(workoutSeed, storedSession)
    addedSetTokensRef.current = buildStoredAddedSetTokenMap(storedSession)
    deletedSetIdsRef.current = new Set(storedSession?.deletedSetIds ?? [])
    programSetTargetsRef.current = buildProgramSetTargetMap(nextWorkout.originalExercises)
    setWorkout(nextWorkout)
    setExercises(nextWorkout.exercises)
    setCurrentExerciseIndex(storedSession
      ? Math.min(Math.max(0, storedSession.currentExerciseIndex), Math.max(0, nextWorkout.exercises.length - 1)) : 0)
    setStartTime(storedSession ? restoreWorkoutSessionStartTime(storedSession.startedAt) : new Date())
  }, [draftQuery.data, isDraftResolved, isRefreshingSeed, unsyncedDraft, workout, workoutSeed])

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

  // ── Persist session: localStorage mirror + offline sync queue ──────────────
  // Every change lands in IndexedDB immediately; the sync manager debounces the
  // upload and holds it while offline.
  useEffect(() => {
    if (!workout || !workoutId || !userId || sessionRetiredRef.current) return
    // Unlike the compact session draft, this includes the immutable exercise
    // metadata required to rebuild the logger after iOS has killed the app.
    void saveOfflineWorkoutSnapshot(userId, { ...workout, exercises }).catch(() => undefined)
    const storageKey = getWorkoutSessionStorageKey(workoutId)
    if (!hasSessionProgress(exercises) && deletedSetIdsRef.current.size === 0) {
      window.localStorage.removeItem(storageKey)
      void queueWorkoutSessionDraftDelete(userId, workoutId).catch(() => undefined)
      return
    }
    const storedSession = createStoredWorkoutSession(
      exercises,
      startTime,
      currentExerciseIndex,
      addedSetTokensRef.current,
      workout.name,
      deletedSetIdsRef.current,
    )
    window.localStorage.setItem(storageKey, JSON.stringify(storedSession))
    void queueWorkoutSessionDraft(userId, workoutId, storedSession).catch(() => undefined)
  }, [currentExerciseIndex, exercises, startTime, userId, workout, workoutId])

  // ── Auto-advance: scroll the active exercise into view ─────────────────────
  useEffect(() => {
    if (!shouldAutoScrollExerciseRef.current) return
    shouldAutoScrollExerciseRef.current = false

    // "nearest" only scrolls if the next exercise is off screen. With finished
    // exercises sinking to the bottom, the next one usually slides up into the
    // card the trainee was just looking at, so most of the time nothing moves.
    const frameId = requestAnimationFrame(() => {
      exerciseRefs.current[currentExerciseIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
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
  const completedExercises = exercises.filter(isExerciseDone).length
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
        // Carried over so the row keeps the exact label the picker showed,
        // curated import names included, instead of a recomposed one.
        displayName: variation.displayName,
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
                displayName: variation.displayName,
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
        deletedSetIdsRef.current = new Set(
          [...deletedSetIdsRef.current].map((id) => setIdMap[id] ?? id),
        )

        // Migrate the in-progress localStorage session under the new workoutId with
        // remapped exercise/set IDs so completed sets and entered weights survive
        // the redirect (and clear the old key so it doesn't linger).
        migrateStoredWorkoutSession(workoutId, response)
        retireSession(workoutId)
        router.replace(`/workout/${response.workoutId}/start`)
      }
    } catch (swapError) {
      setError(swapError instanceof Error ? swapError.message : "Không thể đổi bài tập.")
    } finally {
      setSwapInFlight(false)
    }
  }

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    const exercise = exercises.find((ex) => ex.id === exerciseId)
    if (!exercise || exercise.sets.length <= 1 || !exercise.sets.some((set) => set.id === setId)) return
    deletedSetIdsRef.current.add(setId)
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
        displayName: exercise.variation.displayName,
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

      // Finishing an exercise moves on to the next one still to do. Done
      // exercises sink to the bottom of the list, so "next" is never one the
      // trainee already finished out of order.
      const updatedSets = exercise.sets.map((s) => (s.id === set.id ? { ...s, ...data } : s))
      if (updatedSets.every((s) => s.completed)) {
        const exIdx = exercises.findIndex((e) => e.id === exercise.id)
        const afterThisSet = exercises.map((e) => (e.id === exercise.id ? { ...e, sets: updatedSets } : e))
        const nextIndex = exIdx >= 0 ? nextIncompleteExercise(afterThisSet, exIdx) : null
        if (nextIndex != null) {
          shouldAutoScrollExerciseRef.current = true
          setCurrentExerciseIndex(nextIndex)
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

  const handleApplyCoachHint = (hint: CoachHint, exerciseId: string) => {
    setAppliedHintSlugs((prev) => [...prev, hint.muscleSlug])
    handleAddSet(exerciseId)
    answerRecommendation.mutate({
      muscleSlug: hint.muscleSlug,
      status: "applied",
      weekStart: volumeRecoveryQuery.data?.weekStart,
    })
  }

  /**
   * Stops this page from writing the session again and queues removal of the
   * server draft. Without the flag, a state update still rendering (a forked
   * swap remaps exercises right before redirecting) would re-queue the draft
   * after its delete and resurrect it.
   */
  const retireSession = (retiredWorkoutId: string) => {
    sessionRetiredRef.current = true
    if (userId) void queueWorkoutSessionDraftDelete(userId, retiredWorkoutId).catch(() => undefined)
  }

  const performSave = async (logDate: Date = new Date()) => {
    // No session check: offline with an expired token there is none, and the
    // log is queued until a refreshed token can send it.
    if (!userId || !workout) return
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
    const input = {
      // Minted once per finish so a retried or replayed send cannot log twice.
      clientLogId: createClientLogId(),
      completedAt: loggedCompletedAt.toISOString(),
      exercises,
      plannedDate: resolvePlannedDateForWorkout(workout, loggedStartedAt),
      startedAt: loggedStartedAt.toISOString(),
    }
    try {
      let savedOnline = false
      if (navigator.onLine) {
        try {
          await logMutation.mutateAsync({ workoutId: workout.id, input })
          savedOnline = true
        } catch (saveError) {
          // Only a request that never reached the server is queued; a rejection
          // (validation, missing workout) is shown so the trainee can act on it.
          if (!(saveError instanceof ApiError && saveError.isNetworkError)) throw saveError
        }
      }
      sessionRetiredRef.current = true
      if (savedOnline) {
        void queueWorkoutSessionDraftDelete(userId, workout.id).catch(() => undefined)
        void deleteOfflineWorkoutSnapshot(userId, workout.id).catch(() => undefined)
      } else {
        // Also retires the draft. The dashboard's sync badge shows the log as
        // pending until it uploads.
        await queueWorkoutLog(userId, workout.id, input, workout.name)
      }
      clearStoredWorkoutSession(workout.id)
      // Set on both paths: a queued log is still a finished workout, and the
      // trainee earned the same celebration whether or not the phone had signal.
      // This screen cannot show it itself — the push below unmounts it — so the
      // dashboard spends the flag on arrival.
      markWorkoutCelebration({ savedOnline, workoutName: workout.name })
      router.push("/dashboard")
    } catch (saveError) {
      sessionRetiredRef.current = false
      setError(saveError instanceof Error ? saveError.message : messages.meals.logMealError)
    } finally {
      setIsSaving(false)
    }
  }

  // Finishing with exercises left is easy to do by accident from the pinned
  // bar, so it asks first; a fully done session finishes straight away.
  const handleFinishWorkout = () => {
    if (completedExercises < exercises.length) {
      setShowFinishConfirm(true)
      return
    }
    finishWorkout()
  }

  const finishWorkout = () => {
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
    // A live catch-up session happened today, not on its original planned date.
    // Historical entry still uses the explicit logDate parameter above.
    setSelectedDate(todayMidnight)
    setShowDateDialog(true)
  }

  const handleCancelWorkout = () => {
    if (workout?.id) {
      clearStoredWorkoutSession(workout.id)
      retireSession(workout.id)
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
            {error ||
              (isWorkoutUnavailableOffline
                ? messages.offlineSync.workoutUnavailableOffline
                : messages.workoutPage.thisWorkoutUnavailable)}
          </p>
          <Button className="mt-4" onClick={() => router.push("/workout")}>
            {messages.workoutPage.backToWorkouts}
          </Button>
        </div>
      </div>
    )
  }

  // The coach set a start date the trainee has not reached. The server refuses
  // the log either way; stopping here means they find out before training the
  // session rather than when they try to save it.
  if (workout.lockedUntil) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-warn-soft">
            <CalendarClock className="size-5 text-warning-text" />
          </div>
          <p className="text-lg font-semibold">{messages.workoutPage.lockedTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {messages.workoutPage.lockedBody(workout.lockedUntil)}
          </p>
          <Button
            className="mt-5 w-full"
            disabled={duplicateToRoutineMutation.isPending}
            onClick={async () => {
              setDuplicateError(null)
              try {
                const copy = await duplicateToRoutineMutation.mutateAsync(workout.id)
                router.replace(`/workout/${copy.id}/start`)
              } catch {
                setDuplicateError(messages.workoutPage.lockedTryItFailed)
              }
            }}
          >
            {messages.workoutPage.lockedTryIt}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">{messages.workoutPage.lockedTryItHint}</p>
          {duplicateError ? (
            <p role="alert" className="mt-2 text-sm text-destructive-text">{duplicateError}</p>
          ) : null}
          <Button variant="ghost" className="mt-3 w-full" onClick={() => router.push("/workout")}>
            {messages.workoutPage.backToWorkouts}
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-background">
      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-[880px] min-w-0 px-3 pt-3 pb-2 sm:px-4 md:px-10 md:pt-8">
        {/* Header: date and title on the left, cancel beside them on mobile
            (desktop cancels from the action bar), so it takes one block. On
            phones it stays pinned while scrolling, full-bleed frosted glass
            that matches the page until content slides under it. */}
        <div className="sticky top-0 z-30 -mx-3 mb-2 flex items-start justify-between gap-3 bg-background/85 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-xl sm:-mx-4 sm:px-4 md:static md:mx-0 md:mb-7 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="min-w-0">
            <div className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                {dateLabel}
              </p>
              <SyncStatusBadge />
            </div>
            <h1 className="m-0 mt-1 break-words text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground md:mt-2 md:text-5xl">
              {workout.name}
            </h1>
          </div>
          {/* A destructive pill so ending the session is easy to find. The
              button is a 44px touch target; the pill inside stays compact. */}
          <button
            type="button"
            onClick={handleCancelWorkout}
            className="group flex shrink-0 items-center pointer-coarse:min-h-11 md:hidden"
          >
            <span className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive-soft px-3 py-1.5 text-sm font-medium text-destructive-text transition-colors group-hover:border-destructive/50 group-active:border-destructive/60">
              <X className="h-4 w-4" aria-hidden="true" />
              {messages.workoutPage.cancelWorkout}
            </span>
          </button>
        </div>

        {/* Session stats */}
        <div
          data-tour="session-stats"
          className="mb-5 grid grid-cols-4 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card md:mb-7"
        >
          <StatCell label={messages.workoutPage.started} value={startedLabel} sub={elapsedLabel} />
          <StatCell
            label={messages.workoutPage.set}
            value={`${completedSets}/${totalSets}`}
            sub={messages.workoutPage.completed}
          />
          <StatCell
            label={messages.workoutPage.volume}
            value={Math.round(volume).toLocaleString("en-US")}
            sub={messages.workoutPage.kgLifted}
          />
          <StatCell
            label={messages.workoutPage.exercises}
            value={`${completedExercises}/${exercises.length}`}
            sub={messages.workoutPage.completed}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-sm text-destructive-text">{error}</p>
        )}

        {/* Exercise blocks: still to do first, finished ones at the bottom.
            `index` stays the planned position, which refs and "current" use. */}
        {sessionDisplayOrder(exercises).map((index) => {
          const exercise = exercises[index]
          return (
          <div
            key={exercise.id}
            ref={(el) => {
              exerciseRefs.current[index] = el
            }}
            // Clears the pinned header on phones when an exercise scrolls into view.
            className="scroll-mt-24 md:scroll-mt-4"
          >
            <LiftExerciseBlock
              exercise={exercise}
              coachHint={coachHintForExercise(coachHints, {
                ...exercise.variation,
                muscleGroup: exercise.exercise.muscleGroup,
              })}
              onApplyCoachHint={handleApplyCoachHint}
              programSetTargets={programSetTargetsRef.current}
              weightUnit={weightUnit}
              isCurrent={index === currentExerciseIndex}
              onSetUpdate={(setId, patch) => handleSetUpdate(exercise.id, setId, patch)}
              onSetComplete={(ex, set, data) => handleSetComplete(ex, set, data)}
              onAddSet={handleAddSet}
              onRemoveSet={handleRemoveSet}
              onRemoveExercise={handleRemoveExercise}
              onRequestReplace={handleOpenReplace}
              onExerciseNoteChange={handleExerciseNoteChange}
            />
          </div>
          )
        })}

        {/* Add exercise: after the last card, where the list grows. */}
        <Button
          variant="outline"
          className="w-full gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
          onClick={() => void handleOpenAddExercise()}
        >
          <Plus className="h-4 w-4" />
          {messages.workoutPage.addExercise}
        </Button>

        {/* Bottom action bar: stays pinned to the bottom of the screen while
            scrolling, so finishing never needs a scroll to the end. It has no
            background of its own, so taps around the buttons reach the cards
            underneath. */}
        <div className="pointer-events-none sticky bottom-0 z-30 mt-6 flex gap-2 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:gap-3 md:pb-4">
          {/* Spacer (desktop) */}
          <div className="hidden md:flex flex-1" />

          {/* Cancel (desktop only) */}
          <Button
            variant="ghost"
            className="pointer-events-auto hidden md:flex"
            onClick={handleCancelWorkout}
          >
            {messages.common.cancel}
          </Button>

          {/* Finish workout: slide on phones so a stray tap mid-set cannot end
              the session; a plain button on desktop. */}
          <div data-tour="session-finish" className="pointer-events-auto w-full md:w-auto">
            <SlideToConfirm
              className="md:hidden"
              label={messages.workoutPage.slideToFinish}
              actionLabel={messages.workoutPage.finishWorkout}
              onConfirm={handleFinishWorkout}
              disabled={completedSets === 0}
              disabledLabel={messages.workoutPage.finishNeedsSet}
              busy={isSaving}
              busyLabel={messages.workoutPage.saving}
            />
            <Button
              // Opaque even when disabled: with no bar background, the default
              // half-transparent disabled look would let the cards show through.
              className="hidden bg-foreground font-semibold text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 md:inline-flex"
              onClick={handleFinishWorkout}
              disabled={completedSets === 0 || isSaving}
            >
              {isSaving ? messages.workoutPage.saving : messages.workoutPage.finishWorkout}
            </Button>
          </div>
        </div>
      </main>

      {/* ── Rest Timer overlay ────────────────────────────────────────────── */}
      <RestTimer
        event={restEvent}
        onDismiss={() => setRestEvent(null)}
        defaultDuration={DEFAULT_REST_SECONDS}
      />

      {/* ── Finish with exercises left ────────────────────────────────────── */}
      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{messages.workoutPage.finishUnfinishedTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {messages.workoutPage.finishUnfinishedBody(completedExercises, exercises.length)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinishConfirm(false)}>
              {messages.workoutPage.keepTraining}
            </Button>
            <Button
              onClick={() => {
                setShowFinishConfirm(false)
                finishWorkout()
              }}
              disabled={isSaving}
            >
              {messages.workoutPage.finishAnyway}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
