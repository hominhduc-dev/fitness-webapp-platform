"use client"

import { CalendarClock, Plus } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RestTimer, type RestEvent } from "@/components/workout/rest-timer"
import { SessionExerciseView } from "@/components/workout/session/session-exercise-view"
import { SessionHeader } from "@/components/workout/session/session-header"
import { SessionNavBar } from "@/components/workout/session/session-nav-bar"
import { SessionOptionsSheet } from "@/components/workout/session/session-options-sheet"
import { SessionProgress } from "@/components/workout/session/session-progress"
import type { ProgramSetTarget } from "@/components/workout/session/session-set-row"
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
import type { ExerciseSet, ExerciseVariationOption, WorkoutExercise, Workout } from "@/lib/types"
import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { AppMessages } from "@/lib/i18n/messages"
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
import { isExerciseDone, nextIncompleteExercise } from "@/lib/workout/exercise-order"
import { primaryNavAction } from "@/lib/workout/session-navigation"
import { useDefaultRest } from "@/lib/workout/use-default-rest"

// ─── Session storage helpers (see @/lib/workout/session-storage) ──────────────

function buildProgramSetTargetMap(exercises: Workout["exercises"]) {
  const targets = new Map<string, ProgramSetTarget>()

  exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      targets.set(set.id, {
        reps: set.targetReps,
        repsMin: set.targetRepsMin,
        rir: set.rir,
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
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [showOptions, setShowOptions] = useState(false)
  // The exercise whose note field is open; closes by itself on another exercise.
  const [noteOpenForId, setNoteOpenForId] = useState<string | null>(null)
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
  const [defaultRest, setDefaultRest] = useDefaultRest(userId)

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
  const dateLabel = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    weekday: "long",
  }).format(presetLogDate ?? startTime)

  const exerciseLabels = exercises.map((exercise) =>
    formatExerciseVariationLabel({
      displayName: exercise.variation.displayName,
      exerciseName: exercise.exercise.name,
      isDefault: exercise.variation.isDefault,
      variationName: exercise.variation.name,
    }),
  )
  // The index is kept in range where it changes, but a restored session can
  // still hold one past the end for a render.
  const shownIndex = Math.min(currentExerciseIndex, Math.max(0, exercises.length - 1))
  const currentExercise = exercises[shownIndex] ?? null
  const navAction = primaryNavAction(exercises, shownIndex)
  const skipTarget = currentExercise ? nextIncompleteExercise(exercises, shownIndex) : null

  // ── Handlers ────────────────────────────────────────────────────────────────
  /** Shows another exercise, from its top: each one is a page of its own. */
  const goToExercise = (index: number) => {
    setCurrentExerciseIndex(index)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

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
    const removedIndex = exercises.findIndex((ex) => ex.id === exerciseId)
    if (removedIndex < 0) return
    const remaining = exercises.length - 1
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId))
    // Stay on the exercise that slid into the removed one's place, or step
    // back one when the last was removed; earlier removals shift the index.
    setCurrentExerciseIndex((index) =>
      Math.max(0, Math.min(removedIndex < index ? index - 1 : index, remaining - 1)))
    window.scrollTo({ top: 0, behavior: "smooth" })
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
    goToExercise(exercises.length)
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
        // The coach's rest for this exercise wins; the trainee's default fills in.
        duration: exercise.restTime ?? defaultRest,
        exercise: exerciseLabel,
        set: {
          id: set.id,
          kg: data.weight ?? set.weight ?? null,
          reps: data.actualReps ?? set.actualReps ?? null,
        },
      })
      // No auto-advance: a finished exercise stays on screen so the trainee
      // sees it done, and the bar's "Next" button moves on.
    }
  }

  /** The bar's "Complete set N": logs the active set with what its row holds. */
  const handleCompleteActiveSet = () => {
    if (!currentExercise) return
    const set = currentExercise.sets.find((s) => !s.completed)
    if (!set) return
    const data: Partial<ExerciseSet> = {
      actualReps: set.actualReps ?? set.targetReps,
      completed: true,
      rir: set.rir,
      weight: set.weight,
    }
    handleSetUpdate(currentExercise.id, set.id, data)
    handleSetComplete(currentExercise, set, data)
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

  // Leaving keeps everything: the session is already saved, and the dashboard
  // offers to resume it.
  const handleLeaveSession = () => {
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
  const currentCoachHint = currentExercise
    ? coachHintForExercise(coachHints, {
        ...currentExercise.variation,
        muscleGroup: currentExercise.exercise.muscleGroup,
      })
    : null
  const volumeCopy = messages.volumeRecovery
  const currentCoachHintText = currentCoachHint
    ? volumeCopy.sessionHint(
        currentCoachHint.action,
        volumeCopy.muscleLabels[currentCoachHint.muscleSlug as keyof typeof volumeCopy.muscleLabels] ??
          currentCoachHint.muscleSlug,
        currentCoachHint.currentSets,
        currentCoachHint.recommendedSets,
      )
    : null

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-background">
      {/* One exercise at a time. The bottom padding clears the pinned bar. */}
      <main className="mx-auto w-full max-w-[880px] min-w-0 px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-4 md:px-10">
        <SessionHeader
          dateLabel={dateLabel}
          title={workout.name}
          onLeave={handleLeaveSession}
          onOpenOptions={() => setShowOptions(true)}
        >
          <SessionProgress
            exercises={exercises}
            exerciseLabels={exerciseLabels}
            currentIndex={shownIndex}
            onSelect={goToExercise}
            completedSets={completedSets}
            totalSets={totalSets}
            volume={volume}
            weightUnit={weightUnit}
            startTime={startTime}
          />
        </SessionHeader>

        {error && (
          <p className="mb-4 text-sm text-destructive-text">{error}</p>
        )}

        {currentExercise ? (
          <SessionExerciseView
            key={currentExercise.id}
            exercise={currentExercise}
            exerciseLabel={exerciseLabels[shownIndex]}
            coachHint={currentCoachHint}
            coachHintText={currentCoachHintText}
            onApplyCoachHint={handleApplyCoachHint}
            programSetTargets={programSetTargetsRef.current}
            weightUnit={weightUnit}
            noteOpen={noteOpenForId === currentExercise.id}
            onSetUpdate={(setId, patch) => handleSetUpdate(currentExercise.id, setId, patch)}
            onSetComplete={handleSetComplete}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onExerciseNoteChange={handleExerciseNoteChange}
          />
        ) : (
          // Every exercise removed: nothing to page through, only a way back in.
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">{messages.workoutPage.noExercisesYet}</p>
            <Button className="mt-4 gap-1.5" onClick={handleOpenAddExercise}>
              <Plus className="h-4 w-4" />
              {messages.workoutPage.addExercise}
            </Button>
          </div>
        )}

        <SessionNavBar
          action={navAction}
          targetLabel={navAction.kind === "next" || navAction.kind === "unfinished" ? exerciseLabels[navAction.index] : null}
          canGoBack={shownIndex > 0}
          onBack={() => goToExercise(shownIndex - 1)}
          onGoTo={goToExercise}
          onCompleteSet={handleCompleteActiveSet}
          onFinish={handleFinishWorkout}
          isSaving={isSaving}
        />
      </main>

      {showOptions ? (
        <SessionOptionsSheet
          onClose={() => setShowOptions(false)}
          hasExercise={Boolean(currentExercise)}
          hasNote={Boolean(currentExercise?.notes?.trim())}
          canSkip={skipTarget != null}
          completedSets={completedSets}
          totalSets={totalSets}
          defaultRest={defaultRest}
          onDefaultRestChange={setDefaultRest}
          onSwap={() => {
            if (currentExercise) handleOpenReplace(currentExercise)
          }}
          onNote={() => {
            if (currentExercise) setNoteOpenForId(currentExercise.id)
          }}
          onSkip={() => {
            if (skipTarget != null) goToExercise(skipTarget)
          }}
          onRemoveExercise={() => {
            if (currentExercise) handleRemoveExercise(currentExercise.id)
          }}
          onAddExercise={handleOpenAddExercise}
          onFinishEarly={handleFinishWorkout}
          onCancelWorkout={handleCancelWorkout}
        />
      ) : null}

      {/* ── Rest Timer overlay ────────────────────────────────────────────── */}
      <RestTimer
        event={restEvent}
        onDismiss={() => setRestEvent(null)}
        defaultDuration={defaultRest}
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
