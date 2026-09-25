"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Dumbbell,
  FileText,
  Info,
  Loader2,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

import { useCoachData, useCoachMutation } from "@/lib/queries/coach-data"
import { useExercises, useExerciseLibrary } from "@/lib/queries/exercises"
import { queryKeys } from "@/lib/queries/keys"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  adjustCoachProgram,
  createCoachProgram,
  fetchCoachProgram,
  fetchCoachTrainees,
  restoreCoachProgram,
  unlinkGoogleSheetFromCoachProgram,
  updateCoachProgram,
} from "@/lib/fitness/api"
import { flattenExerciseLibraryToVariationOptions, mergeExerciseOptions } from "@/lib/fitness/exercise-options"
import {
  MAX_WEEKS,
  MIN_WEEKS,
  clampWeeks,
  resolveCurrentWeekProgress,
  resolveProgramAnchor,
  type CurrentWeekProgress,
} from "@/lib/fitness/program-week"
import {
  normalizeSetIntensityAssignments,
  readSetIntensityAssignments,
  type SetIntensityAssignment,
} from "@/lib/workout/intensity-tag"
import { formatRepTarget, parseRepTargetText } from "@/lib/workout-reps"
import type {
  AssignedTrainee,
  CoachProgram,
  CoachTrainee,
  CreateCoachProgramInput,
  ExerciseVariationOption,
} from "@/lib/fitness/types"
import type { AppLocale } from "@/lib/i18n/config"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import { ExportProgramLogsDialog } from "@/components/coach/export-program-logs-dialog"
import { RoutineBuilderDialog, type RoutineDraftData, type RoutineExerciseDraft } from "@/components/workout/routine-builder-dialog"
import { TAG_DOT_COLOR } from "@/lib/fitness/routine-tag"
import { SessionSlotGrid, swapDaySlots, type SessionSlotView } from "@/components/coach/session-slot-grid"
import { useBodyScrollLock } from "@/components/ui/use-body-scroll-lock"

type ProgramEditorProps = {
  initialExerciseOptions?: ExerciseVariationOption[]
  initialTraineeOptions?: CoachTrainee[]
  onClose?: () => void
  onSaved?: (program: CoachProgram) => void
  programId?: string
}

type RoutineTag = "push" | "pull" | "legs" | "upper" | "lower" | "full"

type RoutineExercise = {
  fallbackEquipment?: string
  fallbackExerciseName?: string
  fallbackIsDefault?: boolean
  fallbackMuscleGroup?: string
  fallbackVariationName?: string
  id: string
  rir?: number | string
  reps: string
  restTime?: string
  setIntensityTags?: SetIntensityAssignment[]
  sets: number
  variationId: string
  weight: string
}

type Routine = {
  exercises: RoutineExercise[]
  id: string
  name: string
  tag: RoutineTag
}

type ScheduleSlot = {
  routine: Routine | null
} | null

type Schedule = ScheduleSlot[][]

type PickerSlot = {
  dayIndex: number
  weekIndex: number
}

type BuilderMode =
  | { kind: "create" }
  | { kind: "edit-slot"; slot: PickerSlot }
  | { kind: "edit-library"; routineId: string }

const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6]
const DIFFICULTY_OPTIONS: Array<CoachProgram["difficulty"]> = ["beginner", "intermediate", "advanced"]
const ROUTINE_TAGS: RoutineTag[] = ["push", "pull", "legs", "upper", "lower", "full"]

const DAY_OPTIONS = [
  { label: "Mon", scheduledDay: 1 },
  { label: "Tue", scheduledDay: 2 },
  { label: "Wed", scheduledDay: 3 },
  { label: "Thu", scheduledDay: 4 },
  { label: "Fri", scheduledDay: 5 },
  { label: "Sat", scheduledDay: 6 },
  { label: "Sun", scheduledDay: 0 },
]

function getDayLabels(locale: AppLocale) {
  const formatter = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { weekday: "short" })
  const start = new Date(2024, 0, 1)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return formatter.format(date)
  })
}

function getRoutineTagLabel(tag: RoutineTag, messages: AppMessages) {
  const keyByTag: Record<RoutineTag, keyof AppMessages["workoutPage"]> = {
    full: "tagFull",
    legs: "tagLegs",
    lower: "tagLower",
    pull: "tagPull",
    push: "tagPush",
    upper: "tagUpper",
  }

  return messages.workoutPage[keyByTag[tag]] as string
}

const DAY_PATTERN_BY_DAYS_PER_WEEK: Record<number, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 4, 5, 6],
}



function createFormId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clampDaysPerWeek(value: number) {
  if (DAYS_PER_WEEK_OPTIONS.includes(value)) {
    return value
  }

  return Math.min(6, Math.max(3, value || 4))
}

function resolveInitialActiveWeek(assignedAt: unknown, totalWeeks: number) {
  const progress = resolveCurrentWeekProgress(assignedAt, totalWeeks)

  if (progress?.kind === "active") {
    return progress.weekIndex
  }

  return progress?.kind === "completed" ? Math.max(0, clampWeeks(totalWeeks) - 1) : 0
}

function makeEmptySchedule(weeks: number, daysPerWeek: number): Schedule {
  const activeDays = new Set(DAY_PATTERN_BY_DAYS_PER_WEEK[clampDaysPerWeek(daysPerWeek)] ?? DAY_PATTERN_BY_DAYS_PER_WEEK[4])

  return Array.from({ length: weeks }, () =>
    DAY_OPTIONS.map((_day, dayIndex) => (activeDays.has(dayIndex) ? { routine: null } : null)),
  )
}

function resizeSchedule(current: Schedule, weeks: number, daysPerWeek: number) {
  const next = makeEmptySchedule(weeks, daysPerWeek)

  for (let weekIndex = 0; weekIndex < Math.min(current.length, weeks); weekIndex += 1) {
    for (let dayIndex = 0; dayIndex < DAY_OPTIONS.length; dayIndex += 1) {
      const existingSlot = current[weekIndex]?.[dayIndex]

      if (existingSlot?.routine && next[weekIndex]?.[dayIndex]) {
        next[weekIndex][dayIndex] = existingSlot
      }
    }
  }

  return next
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function resolveExerciseOptionForEditor(
  workoutExercise: CoachProgram["workouts"][number]["exercises"][number],
  exerciseOptions: ExerciseVariationOption[],
) {
  const exactMatch = exerciseOptions.find((option) => option.id === workoutExercise.variation.id)

  if (exactMatch) {
    return exactMatch
  }

  const variationName = workoutExercise.variation.name.trim()
  const isDefaultVariation =
    workoutExercise.variation.isDefault || !variationName || variationName.toLowerCase() === "default"

  if (isDefaultVariation) {
    const defaultByExerciseId = exerciseOptions.find(
      (option) => option.exerciseId === workoutExercise.exercise.id && option.isDefault,
    )

    if (defaultByExerciseId) {
      return defaultByExerciseId
    }
  }

  const matchByNames = exerciseOptions.find(
    (option) =>
      option.exerciseName === workoutExercise.exercise.name &&
      option.variationName === workoutExercise.variation.name,
  )

  if (matchByNames) {
    return matchByNames
  }

  if (isDefaultVariation) {
    return exerciseOptions.find(
      (option) => option.exerciseName === workoutExercise.exercise.name && option.isDefault,
    )
  }

  return undefined
}

function mapWorkoutExerciseToRoutineExercise(
  workoutExercise: CoachProgram["workouts"][number]["exercises"][number],
  exerciseOptions: ExerciseVariationOption[],
): RoutineExercise {
  const resolvedOption = resolveExerciseOptionForEditor(workoutExercise, exerciseOptions)

  return {
    fallbackEquipment: resolvedOption?.equipment ?? workoutExercise.variation.equipment,
    fallbackExerciseName: workoutExercise.exercise.name,
    fallbackIsDefault: workoutExercise.variation.isDefault,
    fallbackMuscleGroup: resolvedOption?.muscleGroup ?? workoutExercise.exercise.muscleGroup,
    fallbackVariationName: workoutExercise.variation.name,
    id: workoutExercise.id || createFormId(),
    rir: workoutExercise.sets[0]?.rir,
    reps: formatRepTarget({
      reps: workoutExercise.sets[0]?.targetReps ?? 1,
      repsMin: workoutExercise.sets[0]?.targetRepsMin,
    }),
    restTime: workoutExercise.restTime != null ? String(workoutExercise.restTime) : "",
    setIntensityTags: readSetIntensityAssignments(workoutExercise.sets),
    sets: workoutExercise.sets.length || 1,
    variationId: resolvedOption?.id ?? workoutExercise.variation.id,
    weight: workoutExercise.sets[0]?.weight != null ? String(workoutExercise.sets[0].weight) : "",
  }
}

function inferTag(name: string, index: number): RoutineTag {
  const normalized = name.toLowerCase()

  if (normalized.includes("push")) return "push"
  if (normalized.includes("pull")) return "pull"
  if (normalized.includes("leg")) return "legs"
  if (normalized.includes("upper")) return "upper"
  if (normalized.includes("lower")) return "lower"
  if (normalized.includes("full")) return "full"

  return ROUTINE_TAGS[index % ROUTINE_TAGS.length]
}

function mapWorkoutToRoutine(
  workout: CoachProgram["workouts"][number],
  index: number,
  exerciseOptions: ExerciseVariationOption[],
  messages: AppMessages,
): Routine {
  return {
    exercises: workout.exercises.map((exercise) => mapWorkoutExerciseToRoutineExercise(exercise, exerciseOptions)),
    id: workout.id || createFormId(),
    name: workout.name || messages.coach.dayFallbackName(index + 1),
    tag: inferTag(workout.name, index),
  }
}

function getDayIndexFromScheduledDay(scheduledDay?: number) {
  if (typeof scheduledDay !== "number") {
    return 0
  }

  const index = DAY_OPTIONS.findIndex((day) => day.scheduledDay === scheduledDay)
  return index >= 0 ? index : 0
}

function mapProgramToSchedule(
  program: CoachProgram,
  weeks: number,
  daysPerWeek: number,
  exerciseOptions: ExerciseVariationOption[],
  messages: AppMessages,
) {
  const schedule = makeEmptySchedule(weeks, daysPerWeek)
  const occurrenceByDay = new Map<number, number>()
  const routines = program.workouts.map((workout, index) => mapWorkoutToRoutine(workout, index, exerciseOptions, messages))

  program.workouts.forEach((workout, index) => {
    const dayIndex = getDayIndexFromScheduledDay(workout.scheduledDay)
    const nextOccurrence = occurrenceByDay.get(dayIndex) ?? 0
    const explicitWeekIndex =
      typeof workout.weekIndex === "number" && Number.isFinite(workout.weekIndex)
        ? Math.max(0, Math.min(weeks - 1, Math.round(workout.weekIndex)))
        : undefined
    const weekIndex = explicitWeekIndex ?? Math.min(nextOccurrence, weeks - 1)

    occurrenceByDay.set(dayIndex, nextOccurrence + 1)
    schedule[weekIndex][dayIndex] = { routine: routines[index] }
  })

  return {
    routines,
    schedule,
  }
}

function estimateWorkoutDuration(exercises: RoutineExercise[]) {
  if (exercises.length === 0) {
    return 30
  }

  return Math.max(30, Math.round(exercises.reduce((sum, exercise) => sum + exercise.sets * 3, 0)))
}

function cloneRoutineForSlot(routine: Routine): Routine {
  return {
    ...routine,
    id: createFormId(),
    exercises: routine.exercises.map((exercise) => ({
      ...exercise,
      id: createFormId(),
    })),
  }
}

function RoutineDot({ tag }: { tag: RoutineTag }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TAG_DOT_COLOR[tag] }} />
}


// ─── Converters: coach Routine ↔ shared RoutineDraftData ────────────────────

function routineToDraft(routine: Routine): RoutineDraftData {
  return {
    id: routine.id,
    name: routine.name,
    tag: routine.tag,
    exercises: routine.exercises.map((ex): RoutineExerciseDraft => ({
      id: ex.id,
      variationId: ex.variationId,
      displayName: ex.fallbackExerciseName
        ? ex.fallbackVariationName
          ? `${ex.fallbackExerciseName} — ${ex.fallbackVariationName}`
          : ex.fallbackExerciseName
        : ex.variationId,
      muscleGroup: ex.fallbackMuscleGroup ?? "",
      equipment: ex.fallbackEquipment,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      rir: ex.rir != null ? String(ex.rir) : "",
      restTime: ex.restTime ?? "",
      setIntensityTags: ex.setIntensityTags,
    })),
  }
}

function draftToRoutine(draft: RoutineDraftData): Routine {
  return {
    id: draft.id ?? createFormId(),
    name: draft.name,
    tag: draft.tag,
    exercises: draft.exercises.map((ex): RoutineExercise => {
      const parts = ex.displayName.split(" — ")
      const parsedRir = Number(ex.rir)
      const parsedRest = Number(ex.restTime)
      return {
        id: ex.id,
        variationId: ex.variationId,
        fallbackExerciseName: parts[0] ?? ex.displayName,
        fallbackVariationName: parts.length > 1 ? parts[1] : undefined,
        fallbackMuscleGroup: ex.muscleGroup,
        fallbackEquipment: ex.equipment,
        fallbackIsDefault: parts.length === 1,
        rir: ex.rir.trim() && Number.isFinite(parsedRir) ? Math.max(0, Math.round(parsedRir)) : undefined,
        restTime: ex.restTime?.trim() && Number.isFinite(parsedRest) ? String(Math.max(0, Math.round(parsedRest))) : undefined,
        setIntensityTags: ex.setIntensityTags,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
      }
    }),
  }
}

function normalizeOptionalWholeNumber(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined
  }

  if (typeof value === "string") {
    const parsedValue = Number(value)
    return value.trim() && Number.isFinite(parsedValue) ? Math.max(0, Math.round(parsedValue)) : undefined
  }

  return undefined
}

function RoutinePickerDialog({
  library,
  onClose,
  onCreateNew,
  onEditLibraryRoutine,
  onPick,
  open,
}: {
  library: Routine[]
  onClose: () => void
  onCreateNew: () => void
  onEditLibraryRoutine: (routine: Routine) => void
  onPick: (routine: Routine) => void
  open: boolean
}) {
  const { messages } = useLocale()
  const [query, setQuery] = useState("")
  const visibleRoutines = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return library.filter((routine) => {
      if (!normalized) {
        return true
      }

      return [routine.name, routine.tag].join(" ").toLowerCase().includes(normalized)
    })
  }, [library, query])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[65] bg-foreground/25 backdrop-blur-[2px]"
        className="z-[90] flex max-h-[72svh] min-h-0 flex-col overflow-hidden rounded-xl border-border p-0 shadow-[var(--glass-shadow)] sm:max-w-[400px]"
      >
        <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold">{messages.coach.pickRoutine}</DialogTitle>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="-mr-1 -mt-1">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative pt-2">
            <Search className="pointer-events-none absolute left-3 top-[1.35rem] h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.coach.searchRoutines}
              className="h-9 bg-background pl-8 text-sm"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleRoutines.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">{messages.coach.noRoutineMatches}</div>
          ) : (
            visibleRoutines.map((routine, index) => (
              <div
                key={routine.id}
                className={cn(
                  "group flex w-full items-center gap-3 px-5 py-3",
                  index < visibleRoutines.length - 1 && "border-b border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => onPick(routine)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:text-foreground"
                >
                  <RoutineDot tag={routine.tag} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{routine.name}</span>
                    <span className="label-micro mt-0.5 block uppercase">
                      {getRoutineTagLabel(routine.tag, messages)} · {messages.coach.exerciseCount(routine.exercises.length)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  title={messages.coach.editRoutine}
                  onClick={() => onEditLibraryRoutine(routine)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3 sm:justify-center">
          <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={onCreateNew}>
            <Plus className="h-3.5 w-3.5" />
            {messages.schedule.createNewRoutine}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProgramEditor({
  initialExerciseOptions = [],
  initialTraineeOptions = [],
  onClose,
  onSaved,
  programId,
}: ProgramEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale, messages } = useLocale()
  const adjustForTraineeId = programId ? searchParams.get("adjustTrainee") ?? undefined : undefined
  const isAdjustMode = Boolean(programId && adjustForTraineeId)

  const [programName, setProgramName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  // As a modal the editor covers the page: the list behind it must stay put,
  // and only the editor's own body scroll.
  useBodyScrollLock(Boolean(onClose))
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("8")
  const [durationDraft, setDurationDraft] = useState("8")
  const [daysPerWeek, setDaysPerWeek] = useState("4")
  const [difficulty, setDifficulty] = useState<CoachProgram["difficulty"]>("beginner")
  const { data: traineeOptions = initialTraineeOptions } = useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees, initialTraineeOptions)
  const rawExercisesQuery = useExercises()
  const libraryQuery = useExerciseLibrary()
  const exercisesQuery = { data: useMemo(() => rawExercisesQuery.data && libraryQuery.data
    ? mergeExerciseOptions(rawExercisesQuery.data, flattenExerciseLibraryToVariationOptions(libraryQuery.data))
    : initialExerciseOptions, [rawExercisesQuery.data, libraryQuery.data, initialExerciseOptions]) }
  const programQuery = useCoachData(queryKeys.coach.program(programId ?? ""), (token) => fetchCoachProgram(token, programId!), undefined, Boolean(programId))
  const createProgram = useCoachMutation(createCoachProgram)
  const updateProgram = useCoachMutation(updateCoachProgram)
  const adjustProgram = useCoachMutation(adjustCoachProgram)
  const restoreProgram = useCoachMutation(restoreCoachProgram)
  const unlinkGoogleSheet = useCoachMutation(unlinkGoogleSheetFromCoachProgram)
  const [initializedProgram, setInitializedProgram] = useState<string | null>(null)
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<string[]>([])
  const [assignedTrainees, setAssignedTrainees] = useState<AssignedTrainee[]>([])
  const [archivedAt, setArchivedAt] = useState<Date | null>(null)
  const [googleSheetConflict, setGoogleSheetConflict] = useState<CoachProgram["googleSheetConflict"]>(null)
  const [routineLibrary, setRoutineLibrary] = useState<Routine[]>([])
  const [schedule, setSchedule] = useState<Schedule>(() => makeEmptySchedule(8, 4))
  const [activeWeek, setActiveWeek] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<PickerSlot | null>(null)
  const [builderMode, setBuilderMode] = useState<BuilderMode | null>(null)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)

  // Derive the draft data for the shared RoutineBuilderDialog (slot or library edit)
  const builderDraft = useMemo((): RoutineDraftData | undefined => {
    if (!builderMode) return undefined
    if (builderMode.kind === "edit-slot") {
      const routine = schedule[builderMode.slot.weekIndex]?.[builderMode.slot.dayIndex]?.routine
      return routine ? routineToDraft(routine) : undefined
    }
    if (builderMode.kind === "edit-library") {
      const routine = routineLibrary.find((r) => r.id === builderMode.routineId)
      return routine ? routineToDraft(routine) : undefined
    }
    return undefined  // "create" mode → empty form
  }, [builderMode, schedule, routineLibrary])
  const [clientQuery, setClientQuery] = useState("")
  const isLoadingPage = Boolean(programId && programQuery.isPending)
  const [isSaving, setIsSaving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isUnlinkingGoogleSheet, setIsUnlinkingGoogleSheet] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Initialize the editable draft once per program/adjustment target. Background
  // refetches update the query cache without replacing unsaved form values.
  const draftIdentity = `${programId ?? "new"}:${adjustForTraineeId ?? ""}`
  if (programQuery.data && initializedProgram !== draftIdentity) {
    const program = programQuery.data
    const nextExerciseOptions = exercisesQuery.data ?? initialExerciseOptions
    setInitializedProgram(draftIdentity)
          const nextWeeks = clampWeeks(program.duration || 8)
          const nextDaysPerWeek = clampDaysPerWeek(program.workoutsPerWeek || program.workouts.length || 4)
          const mapped = mapProgramToSchedule(program, nextWeeks, nextDaysPerWeek, nextExerciseOptions, messages)

          setProgramName(program.name)
          setStartDate(program.startDate ?? "")
          setDescription(program.description ?? "")
          setDuration(String(nextWeeks))
          setDurationDraft(String(nextWeeks))
          setDaysPerWeek(String(nextDaysPerWeek))
          setDifficulty(program.difficulty)
          setSelectedTraineeIds(
            adjustForTraineeId
              ? [adjustForTraineeId]
              : (program.assignedTo ?? program.assignedTrainees.map((trainee) => trainee.id)),
          )
          setAssignedTrainees(program.assignedTrainees)
          setArchivedAt(program.archivedAt ?? null)
          setGoogleSheetConflict(program.googleSheetConflict ?? null)
          setRoutineLibrary(mapped.routines)
          setSchedule(mapped.schedule)

          // Default to the trainee's current week of progress so coaches land on the right week.
          const targetTrainee = adjustForTraineeId
            ? program.assignedTrainees.find((t) => t.id === adjustForTraineeId)
            : program.assignedTrainees[0]
          setActiveWeek(resolveInitialActiveWeek(
            resolveProgramAnchor(program.startDate, targetTrainee?.assignedAt),
            nextWeeks,
          ))
  }

  const totalWeeks = Number(duration) || 8
  const totalDaysPerWeek = Number(daysPerWeek) || 4
  const filledSessions = schedule.reduce(
    (sum, week) => sum + week.filter((slot) => Boolean(slot?.routine?.exercises.length)).length,
    0,
  )
  const totalProgramSlots = schedule.reduce((sum, week) => sum + week.filter((slot) => slot !== null).length, 0)
  const completion = totalProgramSlots > 0 ? Math.min(100, Math.round((filledSessions / totalProgramSlots) * 100)) : 0
  const isArchived = archivedAt !== null
  const canSave = programName.trim().length > 0 && filledSessions > 0 && !isSaving && !isArchived
  const activeWeekSlots = useMemo(() => schedule[activeWeek] ?? schedule[0] ?? [], [activeWeek, schedule])
  const sessionViews = useMemo<SessionSlotView[]>(
    () =>
      DAY_OPTIONS.map((_day, dayIndex) => {
        const slot = activeWeekSlots[dayIndex] ?? null

        if (slot === null) {
          return { kind: "rest" }
        }

        const routine = slot.routine

        return routine
          ? {
              exerciseCount: routine.exercises.length,
              exerciseNames: routine.exercises.map((exercise) => exercise.fallbackExerciseName ?? exercise.fallbackVariationName ?? "Exercise"),
              kind: "session",
              name: routine.name,
              tag: routine.tag,
            }
          : { kind: "empty" }
      }),
    [activeWeekSlots],
  )
  const dayLabels = useMemo(() => getDayLabels(locale), [locale])

  // Compute the trainee's progress through the program (which week they're "currently" in).
  // Uses the adjust-mode trainee when set; otherwise the first assigned trainee.
  // Returns null if no assignment / before start / after program end.
  const currentWeekProgress = useMemo<CurrentWeekProgress>(() => {
    const targetTrainee = adjustForTraineeId
      ? assignedTrainees.find((t) => t.id === adjustForTraineeId)
      : assignedTrainees[0]

    return resolveCurrentWeekProgress(
      resolveProgramAnchor(startDate || undefined, targetTrainee?.assignedAt),
      totalWeeks,
    )
  }, [assignedTrainees, adjustForTraineeId, startDate, totalWeeks])

  const currentWeekIndex = currentWeekProgress?.kind === "active" ? currentWeekProgress.weekIndex : null

  const filteredTrainees = useMemo(() => {
    const normalized = clientQuery.trim().toLowerCase()

    if (!normalized) {
      return traineeOptions
    }

    return traineeOptions.filter((trainee) =>
      [trainee.name, trainee.email, trainee.phone ?? ""].join(" ").toLowerCase().includes(normalized),
    )
  }, [clientQuery, traineeOptions])

  const commitDuration = (rawValue: string) => {
    const parsed = Number(rawValue)
    const nextWeeks = rawValue.trim() && Number.isFinite(parsed) ? clampWeeks(parsed) : totalWeeks

    setDuration(String(nextWeeks))
    setDurationDraft(String(nextWeeks))
    setSchedule((current) => resizeSchedule(current, nextWeeks, totalDaysPerWeek))
    setActiveWeek((current) => Math.min(current, nextWeeks - 1))
  }

  const handleDaysPerWeekChange = (nextValue: string) => {
    const nextDaysPerWeek = Number(nextValue)

    setDaysPerWeek(nextValue)
    setSchedule((current) => resizeSchedule(current, totalWeeks, nextDaysPerWeek))
  }

  const assignRoutineToPickerSlot = (routine: Routine) => {
    if (!pickerSlot) {
      return
    }

    setSchedule((current) =>
      current.map((week, weekIndex) =>
        weekIndex === pickerSlot.weekIndex
          ? week.map((slot, dayIndex) =>
              dayIndex === pickerSlot.dayIndex ? { routine: cloneRoutineForSlot(routine) } : slot,
            )
          : week,
      ),
    )
    setPickerSlot(null)
  }

  /** Central handler for RoutineBuilderDialog save — handles all 3 modes */
  const handleBuilderSave = (routine: Routine) => {
    if (!builderMode) return

    if (builderMode.kind === "create") {
      // New routine: add to library and assign to the pending picker slot
      setRoutineLibrary((current) => [routine, ...current])
      assignRoutineToPickerSlot(routine)
    } else if (builderMode.kind === "edit-slot") {
      // Edit a routine in-place for a specific slot
      const { slot } = builderMode
      setSchedule((current) =>
        current.map((week, weekIndex) =>
          weekIndex === slot.weekIndex
            ? week.map((s, dayIndex) => (dayIndex === slot.dayIndex ? { routine } : s))
            : week,
        ),
      )
      // Also sync to library if the same routine exists there
      setRoutineLibrary((current) => current.map((r) => (r.id === routine.id ? routine : r)))
    } else if (builderMode.kind === "edit-library") {
      // Edit a routine from the library — update library and all schedule slots using it
      setRoutineLibrary((current) => current.map((r) => (r.id === routine.id ? routine : r)))
      setSchedule((current) =>
        current.map((week) =>
          week.map((slot) =>
            slot?.routine?.id === routine.id ? { routine } : slot,
          ),
        ),
      )
    }

    setBuilderMode(null)
    setNotice(
      builderMode.kind === "create"
        ? messages.coach.routineCreatedAssigned(routine.name)
        : messages.coach.routineUpdated(routine.name),
    )
  }

  const toggleRestDay = (weekIndex: number, dayIndex: number) => {
    setSchedule((current) =>
      current.map((week, currentWeekIndex) =>
        currentWeekIndex === weekIndex
          ? week.map((slot, currentDayIndex) =>
              currentDayIndex === dayIndex ? (slot === null ? { routine: null } : null) : slot,
            )
          : week,
      ),
    )
  }

  const moveSessionToDay = (fromDayIndex: number, toDayIndex: number) => {
    setSchedule((current) =>
      current.map((week, weekIndex) =>
        weekIndex === activeWeek ? swapDaySlots(week, fromDayIndex, toDayIndex) : week,
      ),
    )
  }

  const openSlot = (dayIndex: number) => {
    if ((schedule[activeWeek] ?? [])[dayIndex] === null) {
      toggleRestDay(activeWeek, dayIndex)
      return
    }

    setPickerSlot({ dayIndex, weekIndex: activeWeek })
  }

  const editSlot = (dayIndex: number) =>
    setBuilderMode({ kind: "edit-slot", slot: { dayIndex, weekIndex: activeWeek } })

  const toggleRestForDay = (dayIndex: number) => toggleRestDay(activeWeek, dayIndex)

  const copyActiveWeekToAll = () => {
    const sourceWeek = schedule[activeWeek]

    if (!sourceWeek) {
      return
    }

    setSchedule((current) =>
      current.map((week, weekIndex) =>
        weekIndex === activeWeek
          ? week
          : sourceWeek.map((slot) => (slot?.routine ? { routine: cloneRoutineForSlot(slot.routine) } : slot === null ? null : { routine: null })),
      ),
    )
    setNotice(messages.coach.copyWeekToAllNotice(activeWeek + 1))
  }

  const toggleTraineeAssignment = (traineeId: string, checked: boolean) => {
    if (isAdjustMode && adjustForTraineeId) {
      setSelectedTraineeIds(checked ? [adjustForTraineeId] : [])
      return
    }

    setSelectedTraineeIds((current) =>
      checked ? Array.from(new Set([...current, traineeId])) : current.filter((id) => id !== traineeId),
    )
  }

  const buildProgramPayload = (): CreateCoachProgramInput => {
    const workouts = schedule.flatMap((week, weekIndex) =>
      week.flatMap((slot, dayIndex) => {
        const routine = slot?.routine

        if (!routine || routine.exercises.length === 0) {
          return []
        }

        return [
          {
            duration: estimateWorkoutDuration(routine.exercises),
            exercises: routine.exercises.map((exercise, exerciseIndex) => {
              if (!exercise.variationId.trim()) {
                const routineLabel = routine.name.trim() || messages.coach.weekDayLabel(weekIndex + 1, dayIndex + 1)
                throw new Error(messages.coach.exerciseRequiredError(routineLabel, exerciseIndex + 1))
              }

              const repTarget = parseRepTargetText(exercise.reps)

              if (!repTarget) {
                const routineLabel = routine.name.trim() || messages.coach.weekDayLabel(weekIndex + 1, dayIndex + 1)
                throw new Error(messages.coach.invalidRepRangeError(routineLabel, exerciseIndex + 1))
              }

              const parsedWeight = Number(exercise.weight)
              const parsedRest = Number(exercise.restTime)
              const normalizedRir = normalizeOptionalWholeNumber(exercise.rir)
              const setIntensityTags = normalizeSetIntensityAssignments(exercise.setIntensityTags, exercise.sets)

              return {
                reps: repTarget.reps,
                repsMin: repTarget.repsMin,
                rir: normalizedRir,
                restTime: exercise.restTime?.trim() && Number.isFinite(parsedRest) ? Math.max(0, Math.round(parsedRest)) : undefined,
                setIntensityTags: setIntensityTags.length ? setIntensityTags : undefined,
                sets: exercise.sets,
                variationId: exercise.variationId,
                weight:
                  exercise.weight.trim() && Number.isFinite(parsedWeight)
                    ? Math.max(0, parsedWeight)
                    : undefined,
              }
            }),
            name: routine.name.trim() || messages.coach.weekDayFallback(weekIndex + 1, dayLabels[dayIndex] ?? DAY_OPTIONS[dayIndex].label),
            scheduledDay: DAY_OPTIONS[dayIndex].scheduledDay,
            weekIndex,
          },
        ]
      }),
    )

    return {
      assignToUserIds: selectedTraineeIds,
      description: description.trim() || undefined,
      difficulty,
      duration: totalWeeks,
      name: programName.trim(),
      startDate: startDate.trim() || null,
      workouts,
    }
  }

  const handleRestoreFromEditor = async () => {
    if (!programId || !isArchived || isRestoring) return
    setIsRestoring(true)
    setError(null)
    try {
      const restored = await restoreProgram.mutateAsync([programId])
      setArchivedAt(restored.archivedAt ?? null)
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : messages.coach.programSaveError)
    } finally {
      setIsRestoring(false)
    }
  }

  const handleUnlinkGoogleSheet = async () => {
    if (!programId || isUnlinkingGoogleSheet) return
    setIsUnlinkingGoogleSheet(true)
    setError(null)
    try {
      const updated = await unlinkGoogleSheet.mutateAsync([programId])
      setGoogleSheetConflict(updated.googleSheetConflict ?? null)
      setNotice(messages.coach.googleSheetUnlinked)
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : messages.coach.unlinkGoogleSheetError)
    } finally {
      setIsUnlinkingGoogleSheet(false)
    }
  }

  const handleSaveProgram = async () => {
    if (!canSave) {
      return
    }

    if (builderMode) {
      setError(messages.coach.programEditorOpenUnsaved)
      return
    }

    let payload: CreateCoachProgramInput

    try {
      payload = buildProgramPayload()
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : messages.coach.programNormalizeError)
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const savedProgram =
        programId && adjustForTraineeId
          ? await adjustProgram.mutateAsync([programId, adjustForTraineeId, payload])
          : programId
            ? await updateProgram.mutateAsync([programId, payload])
            : await createProgram.mutateAsync([payload])

      if (onSaved || onClose) {
        onSaved?.(savedProgram)
        onClose?.()
          return savedProgram
      }

      router.push(adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs")

      return savedProgram
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : messages.coach.programSaveError)
    } finally {
      setIsSaving(false)
    }
  }

  const isModal = Boolean(onClose)

  if (programQuery.error) return <div role="alert">{programQuery.error.message}</div>

  if (isLoadingPage) {
    return <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">{messages.coach.loadingProgram}</div>
  }

  const weekPicker = (
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {Array.from({ length: totalWeeks }).map((_, index) => {
        const week = schedule[index] ?? []
        const weekTotal = week.filter((slot) => slot !== null).length
        const weekFilled = week.filter((slot) => Boolean(slot?.routine?.exercises.length)).length
        const isActive = activeWeek === index
        const isComplete = weekTotal > 0 && weekFilled === weekTotal
        const isCurrentWeek = currentWeekIndex === index

        return (
          <button
            key={index}
            type="button"
            onClick={() => setActiveWeek(index)}
            title={isCurrentWeek ? messages.coach.currentlyOnWeek(index + 1, totalWeeks) : undefined}
            className={cn(
              "relative flex h-10 min-w-[60px] items-center justify-center rounded-xl border px-4 font-mono text-sm font-semibold transition-all duration-150 ease-[cubic-bezier(.2,.7,.2,1)]",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-input bg-background/70 text-foreground hover:bg-muted",
              isCurrentWeek && "ring-1 ring-primary ring-offset-1 ring-offset-muted",
            )}
          >
            {isCurrentWeek ? (
              <span className="absolute -top-1.5 right-1 rounded-sm bg-primary px-1 py-px text-micro font-semibold tracking-[0.08em] text-primary-foreground">
                {messages.coach.currentWeekBadge}
              </span>
            ) : null}
            {index + 1}
            {isComplete ? <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-success" /> : null}
          </button>
        )
      })}
    </div>
  )

  return (
    <div
      className={cn(
        isModal
          ? "fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-background/55 p-2 backdrop-blur-md sm:p-6"
          : "mx-auto w-full max-w-[880px] pb-8",
      )}
      aria-busy={isSaving}
    >
      {isSaving ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-[var(--glass-shadow)]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h2 className="mt-5 text-xl font-semibold">{messages.coach.savingProgram}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{messages.coach.updateProgramDetails}</p>
          </div>
        </div>
      ) : null}

      <div
        data-tour="coach-workout-builder"
        className={cn(
          "glass-surface flex w-full max-w-[min(1480px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[var(--glass-shadow)]",
          isModal && "h-[calc(100svh-1rem)] max-h-[980px] sm:h-auto sm:max-h-[calc(100svh-3rem)]",
        )}
      >
        <div className="shrink-0 bg-background/25 px-4 pb-3 pt-4 sm:px-6 md:px-8 md:pb-2.5 md:pt-3.5">
          <div className="mb-4 flex items-start justify-between gap-4 md:mb-3 md:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Dumbbell className="h-3.5 w-3.5" />
                </span>
                <span className="h-5 w-px bg-border" aria-hidden="true" />
                {isAdjustMode ? messages.coach.adjustProgram : programId ? messages.coach.editProgram : messages.coach.newProgram}
              </p>
              <div className="md:flex md:items-baseline md:gap-3">
              <h1 className="mt-2 truncate text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-3xl md:mt-1 md:text-2xl">
                {programId ? programName.trim() || messages.coach.untitledProgram : "Create Workout Program"}
              </h1>
              {currentWeekProgress ? (
                <p className="mt-1 shrink-0 font-mono text-xs text-primary tnum md:mt-0">
                  {currentWeekProgress.kind === "active"
                    ? messages.coach.currentlyOnWeek(currentWeekProgress.weekIndex + 1, totalWeeks)
                    : currentWeekProgress.kind === "not-started"
                      ? messages.coach.currentWeekNotStarted
                      : messages.coach.currentWeekCompleted}
                </p>
              ) : null}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground md:hidden">
                Build a structured training program and assign it to your clients.
              </p>
            </div>
            <div className="hidden shrink-0 flex-wrap items-center gap-2 md:flex">
              {programId && assignedTrainees.length > 0 && (
                <ExportProgramLogsDialog
                  assignedTrainees={assignedTrainees}
                  programDuration={Number(duration) || 8}
                  programId={programId}
                  programName={programName || messages.coach.program}
                  programStartDate={startDate || undefined}
                />
              )}
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-primary/15 bg-primary-soft/50 text-foreground hover:bg-primary-soft"
                disabled={isArchived}
                onClick={() => setIsAssignDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                {messages.coach.assignClients}
                {selectedTraineeIds.length > 0 ? (
                  <Badge variant="micro" className="ml-1 bg-background">
                    {selectedTraineeIds.length}
                  </Badge>
                ) : null}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {onClose ? (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close editor">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs"} aria-label="Close editor">
                  <X className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {/* One surface for the details: on mobile its header is the collapse
              toggle (with a one-line summary), so the title is not repeated
              inside; from md up the fields are always shown. */}
          <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:p-4 md:px-4 md:py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl text-left md:hidden"
              aria-expanded={isDetailsExpanded}
              aria-controls="program-details-fields"
              onClick={() => setIsDetailsExpanded((current) => !current)}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{messages.coach.programDetails}</span>
                  <span className="block truncate text-micro text-muted-foreground">
                  {messages.coach.weeks(totalWeeks)} · {messages.coach.daysPerWeek(totalDaysPerWeek)} · {difficulty}
                  </span>
                </span>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isDetailsExpanded && "rotate-180")}
              />
            </button>

            <div
              id="program-details-fields"
              className={cn(
                "border-t border-border pt-3 md:border-t-0 md:pt-0",
                !isDetailsExpanded && "hidden md:block",
                isArchived && "pointer-events-none opacity-60",
              )}
            >
              <div className="grid grid-cols-2 items-start gap-x-2.5 gap-y-2 md:grid-cols-3 md:gap-x-4 md:gap-y-2.5 xl:grid-cols-[1.35fr_0.8fr_1fr_1fr_1.05fr_1.6fr]">
                <label className="col-span-2 space-y-0.5 md:col-span-1 md:space-y-1">
                  <span className="text-micro font-medium text-muted-foreground md:text-xs">{messages.coach.programName} <span className="text-destructive-text">*</span></span>
                  <span className="relative block">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={programName}
                    onChange={(event) => setProgramName(event.target.value)}
                    placeholder={messages.coach.programNamePlaceholder}
                      className="h-9 bg-background/65 pl-10 md:h-10"
                  />
                  </span>
                </label>
                <label className="space-y-0.5 md:space-y-1">
                  <span className="text-micro font-medium text-muted-foreground md:text-xs">{messages.coach.programDuration} <span className="text-destructive-text">*</span></span>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={MIN_WEEKS}
                      max={MAX_WEEKS}
                      value={durationDraft}
                      onChange={(event) => setDurationDraft(event.target.value)}
                      onBlur={(event) => commitDuration(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          commitDuration(event.currentTarget.value)
                          event.currentTarget.blur()
                        }
                      }}
                      aria-label={messages.coach.weeks(totalWeeks)}
                      className="h-9 bg-background/65 pr-14 tnum md:h-10 md:pr-16"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-micro text-muted-foreground md:text-xs">
                      {messages.coach.weeksUnit}
                    </span>
                  </div>
                </label>
                <label className="space-y-0.5 md:space-y-1">
                  <span className="text-micro font-medium text-muted-foreground md:text-xs">{messages.coach.programFrequency} <span className="text-destructive-text">*</span></span>
                  <Select value={daysPerWeek} onValueChange={handleDaysPerWeekChange}>
                    <SelectTrigger className="h-9 w-full bg-background/65 md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] border-border bg-card">
                      {DAYS_PER_WEEK_OPTIONS.map((dayCount) => (
                        <SelectItem key={dayCount} value={String(dayCount)}>
                          {messages.coach.daysPerWeek(dayCount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-0.5 md:space-y-1">
                  <span className="text-micro font-medium text-muted-foreground md:text-xs">{messages.coach.programDifficulty} <span className="text-destructive-text">*</span></span>
                  <Select value={difficulty} onValueChange={(value) => setDifficulty(value as CoachProgram["difficulty"])}>
                    <SelectTrigger className="h-9 w-full bg-background/65 capitalize md:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] border-border bg-card">
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option} className="capitalize">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-0.5 md:space-y-1">
                  <span className="flex items-center gap-1 text-micro font-medium text-muted-foreground md:text-xs">
                    {messages.coach.programStartDate} <span className="text-destructive-text">*</span>
                    <span className="hidden md:inline-flex" title={messages.coach.programStartDateHint}>
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </span>
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    aria-describedby="program-start-date-hint"
                    className="h-9 bg-background/65 tnum md:h-10"
                  />
                  <span id="program-start-date-hint" className="sr-only">
                    {messages.coach.programStartDateHint}
                  </span>
                </label>
                <label className="col-span-2 space-y-0.5 md:col-span-1 md:space-y-1">
                  <span className="text-micro font-medium text-muted-foreground md:text-xs">{messages.coach.programFocus}</span>
                  <span className="relative block">
                    <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  {/* pr clears the counter below: `200/200` is the widest it ever
                      gets (font-mono + tnum, so the width is fixed) at 49px, plus
                      its right-3 offset — 61px. pr-16 left 3px of that, which a
                      font fallback would swallow. */}
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={messages.coach.descriptionPlaceholder}
                      className="h-9 bg-background/65 pl-10 pr-[4.5rem] text-sm md:h-10"
                    disabled={isArchived}
                    maxLength={200}
                  />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground tnum">
                      {description.length}/200
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className={cn("mt-3 flex flex-wrap items-center gap-2 md:hidden", !isDetailsExpanded && "hidden")}>
            <div className="flex flex-wrap items-center gap-2">
              {programId && assignedTrainees.length > 0 && (
                <ExportProgramLogsDialog
                  assignedTrainees={assignedTrainees}
                  programDuration={Number(duration) || 8}
                  programId={programId}
                  programName={programName || messages.coach.program}
                  programStartDate={startDate || undefined}
                />
              )}
              <Button type="button" variant="outline" className="bg-transparent" disabled={isArchived} onClick={() => setIsAssignDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />
                {messages.coach.assignClients}
                {selectedTraineeIds.length > 0 ? (
                  <Badge variant="micro" className="ml-1 bg-muted">
                    {selectedTraineeIds.length}
                  </Badge>
                ) : null}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background/10 px-4 pb-3 sm:px-6 md:px-8 xl:flex xl:flex-col">
          {isArchived ? (
            <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Program này đã archive (chỉ đọc). Restore để chỉnh sửa.
            </div>
          ) : null}
          {googleSheetConflict ? (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text sm:flex-row sm:items-center sm:justify-between">
              <span>
                {messages.coach.googleSheetConflictBanner(
                  googleSheetConflict.conflictingNames.length > 0
                    ? googleSheetConflict.conflictingNames.join(", ")
                    : messages.coach.genericConflictingTrainee,
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 rounded-xl border-destructive/30 bg-background/70 text-destructive-text hover:bg-destructive-soft"
                disabled={isUnlinkingGoogleSheet}
                onClick={() => void handleUnlinkGoogleSheet()}
              >
                {isUnlinkingGoogleSheet ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isUnlinkingGoogleSheet ? messages.coach.unlinkingGoogleSheet : messages.coach.unlinkGoogleSheet}
              </Button>
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mb-4 rounded-lg border border-success/20 bg-ok-soft px-4 py-3 text-sm text-success-text">
              {notice}
            </div>
          ) : null}

          <section className="rounded-2xl border border-border bg-card/80 p-3.5 shadow-sm sm:p-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:py-3" data-tour="coach-workout-exercises">
            {/* One row from lg up (title, week picker, actions) so the day grid
                below gets the height instead of the chrome around it. */}
            <div className="mb-4 flex flex-col gap-3 lg:mb-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <div className="flex min-w-0 shrink-0 items-start gap-3 lg:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary lg:h-8 lg:w-8">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-base font-semibold text-foreground"
                    title={`Drag and drop to rearrange workouts. You can copy week ${activeWeek + 1} to other weeks.`}
                  >
                    Weekly Structure
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground lg:hidden">
                    Drag and drop to rearrange workouts. You can copy week {activeWeek + 1} to other weeks.
                  </span>
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3 lg:flex-1">
                <p className="shrink-0 text-sm font-semibold text-muted-foreground">{messages.coach.week}</p>
                {weekPicker}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="rounded-xl bg-background/70" disabled={isArchived} onClick={copyActiveWeekToAll}>
                  <Copy className="h-4 w-4" />
                  Copy week {activeWeek + 1} to all
                </Button>
                <Button type="button" variant="outline" className="rounded-xl bg-background/70" disabled>
                  <Trash2 className="h-4 w-4" />
                  Clear all
                </Button>
              </div>
            </div>

            <SessionSlotGrid
              className={cn("xl:min-h-0 xl:flex-1", isArchived && "pointer-events-none opacity-70")}
              dayLabels={dayLabels}
              disabled={isArchived}
              onEdit={editSlot}
              onMove={moveSessionToDay}
              onOpen={openSlot}
              onToggleRest={toggleRestForDay}
              views={sessionViews}
            />
          </section>
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-3 glass-veil border-t border-border/70 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-sm text-muted-foreground tnum">{messages.coach.filledSessionsCount(filledSessions, totalProgramSlots)}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-border sm:max-w-sm">
              <div
                className={cn("h-full transition-[width] duration-200", completion === 100 ? "bg-success" : "bg-primary")}
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-end" data-tour="coach-workout-save">
          {onClose ? (
            <Button type="button" variant="outline" className="w-full rounded-xl bg-background/70 sm:w-auto" onClick={onClose}>
              {messages.common.cancel}
            </Button>
          ) : (
            <Button variant="outline" asChild className="w-full rounded-xl bg-background/70 sm:w-auto">
              <Link href={adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs"}>{messages.common.cancel}</Link>
            </Button>
          )}
          {isArchived ? (
            <Button
              type="button"
              className="w-full rounded-xl sm:w-auto"
              disabled={isRestoring}
              onClick={() => void handleRestoreFromEditor()}
            >
              {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Restore
            </Button>
          ) : (
            <Button type="button" className="w-full rounded-xl sm:w-auto" onClick={() => void handleSaveProgram()} disabled={!canSave}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {!isSaving ? <Check className="h-4 w-4" /> : null}
              {isSaving ? messages.common.saving : programId ? messages.common.saveChanges : messages.coach.saveProgram}
            </Button>
          )}
          </div>
        </div>
      </div>

      <RoutinePickerDialog
        open={Boolean(pickerSlot) && !builderMode}
        library={routineLibrary}
        onClose={() => setPickerSlot(null)}
        onPick={assignRoutineToPickerSlot}
        onCreateNew={() => setBuilderMode({ kind: "create" })}
        onEditLibraryRoutine={(routine) => setBuilderMode({ kind: "edit-library", routineId: routine.id })}
      />

      <RoutineBuilderDialog
        open={Boolean(builderMode)}
        onOpenChange={(v) => { if (!v) setBuilderMode(null) }}
        draftToEdit={builderDraft}
        onSaveDraft={(draft) => handleBuilderSave(draftToRoutine(draft))}
      />

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="z-[90] max-h-[80svh] overflow-hidden rounded-xl border-border p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-xl font-semibold">{messages.coach.assignClients}</DialogTitle>
            <div className="relative pt-2">
              <Search className="pointer-events-none absolute left-3 top-[1.35rem] h-4 w-4 text-muted-foreground" />
              <Input
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
                placeholder={messages.coach.searchClients}
                className="bg-background pl-9"
              />
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            {filteredTrainees.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{messages.coach.noClientsFound}</div>
            ) : (
              <div className="space-y-2">
                {filteredTrainees.map((trainee) => {
                  const checked = selectedTraineeIds.includes(trainee.id)

                  return (
                    <label
                      key={trainee.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleTraineeAssignment(trainee.id, Boolean(value))}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={trainee.avatar ?? undefined} alt={trainee.name} />
                        <AvatarFallback className="bg-foreground text-micro text-background">
                          {getInitials(trainee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{trainee.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{trainee.email}</span>
                      </span>
                      {checked ? <Check className="h-4 w-4 text-primary" /> : null}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-border px-6 py-4">
            <span className="mr-auto self-center font-mono text-xs text-muted-foreground tnum">
              {messages.coach.selectedCount(selectedTraineeIds.length)}
            </span>
            <Button type="button" variant="ghost" onClick={() => setIsAssignDialogOpen(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" onClick={() => setIsAssignDialogOpen(false)}>
              {messages.coach.assignCount(selectedTraineeIds.length)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
