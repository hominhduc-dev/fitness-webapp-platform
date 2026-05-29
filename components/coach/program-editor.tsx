"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ExercisePicker } from "@/components/exercises/exercise-picker"
import { useAuth } from "@/components/providers/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  adjustCoachProgram,
  createCoachProgram,
  fetchCoachProgram,
  fetchCoachTrainees,
  fetchExerciseLibrary,
  fetchExercises,
  updateCoachProgram,
} from "@/lib/fitness/api"
import { flattenExerciseLibraryToVariationOptions, mergeExerciseOptions } from "@/lib/fitness/exercise-options"
import { formatRepTarget, parseRepTargetText } from "@/lib/workout-reps"
import type {
  CoachProgram,
  CoachTrainee,
  CreateCoachProgramInput,
  ExerciseVariationOption,
} from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

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
  reps: string
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

const WEEK_OPTIONS = [4, 6, 8, 10, 12, 16]
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

const DAY_PATTERN_BY_DAYS_PER_WEEK: Record<number, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 4, 5, 6],
}

const TAG_DOT_COLOR: Record<RoutineTag, string> = {
  full: "var(--muted-foreground)",
  legs: "var(--warning)",
  lower: "var(--chart-5)",
  pull: "var(--success)",
  push: "var(--primary)",
  upper: "var(--chart-4)",
}

function createFormId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clampWeeks(value: number) {
  if (WEEK_OPTIONS.includes(value)) {
    return value
  }

  return WEEK_OPTIONS.reduce((nearest, option) =>
    Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest,
  )
}

function clampDaysPerWeek(value: number) {
  if (DAYS_PER_WEEK_OPTIONS.includes(value)) {
    return value
  }

  return Math.min(6, Math.max(3, value || 4))
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
    reps: formatRepTarget({
      reps: workoutExercise.sets[0]?.targetReps ?? 1,
      repsMin: workoutExercise.sets[0]?.targetRepsMin,
    }),
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
): Routine {
  return {
    exercises: workout.exercises.map((exercise) => mapWorkoutExerciseToRoutineExercise(exercise, exerciseOptions)),
    id: workout.id || createFormId(),
    name: workout.name || `Day ${index + 1}`,
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
) {
  const schedule = makeEmptySchedule(weeks, daysPerWeek)
  const occurrenceByDay = new Map<number, number>()
  const routines = program.workouts.map((workout, index) => mapWorkoutToRoutine(workout, index, exerciseOptions))

  program.workouts.forEach((workout, index) => {
    const dayIndex = getDayIndexFromScheduledDay(workout.scheduledDay)
    const nextOccurrence = occurrenceByDay.get(dayIndex) ?? 0
    const weekIndex = Math.min(nextOccurrence, weeks - 1)

    occurrenceByDay.set(dayIndex, nextOccurrence + 1)
    schedule[weekIndex][dayIndex] = { routine: routines[index] }
  })

  return {
    routines,
    schedule,
  }
}

function createEmptyRoutineExercise(): RoutineExercise {
  return {
    id: createFormId(),
    reps: "8-12",
    sets: 3,
    variationId: "",
    weight: "",
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

function RoutineTagBadge({ tag }: { tag: RoutineTag }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      <RoutineDot tag={tag} />
      {tag}
    </span>
  )
}

function SessionSlot({
  dayLabel,
  onClick,
  onToggleRest,
  slot,
}: {
  dayLabel: string
  onClick: () => void
  onToggleRest: () => void
  slot: ScheduleSlot
}) {
  const isRest = slot === null
  const routine = slot?.routine ?? null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[100px] flex-col rounded-[8px] border p-3 text-left transition-colors duration-150 ease-[cubic-bezier(.2,.7,.2,1)]",
        isRest
          ? "border-dashed border-border bg-transparent hover:border-input"
          : "border-border bg-muted/50 hover:border-input hover:bg-muted",
      )}
    >
      <span className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {dayLabel}
        </span>
        {!isRest ? (
          <span
            role="button"
            tabIndex={0}
            title="Mark as rest day"
            className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              onToggleRest()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                event.stopPropagation()
                onToggleRest()
              }
            }}
          >
            <X className="h-3 w-3" />
          </span>
        ) : null}
      </span>

      {routine ? (
        <span className="mt-5 min-w-0">
          <RoutineTagBadge tag={routine.tag} />
          <span className="mt-2 block truncate text-[13px] font-medium text-foreground">{routine.name}</span>
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground tnum">
            {routine.exercises.length} move{routine.exercises.length === 1 ? "" : "s"}
          </span>
        </span>
      ) : isRest ? (
        <span className="flex flex-1 items-center justify-center text-xs text-muted-foreground/50">Rest</span>
      ) : (
        <span className="flex flex-1 items-center justify-center text-muted-foreground">
          <Plus className="h-4 w-4" />
        </span>
      )}
    </button>
  )
}

function RoutinePickerDialog({
  library,
  onClose,
  onCreateNew,
  onPick,
  open,
}: {
  library: Routine[]
  onClose: () => void
  onCreateNew: () => void
  onPick: (routine: Routine) => void
  open: boolean
}) {
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
      <DialogContent className="z-[90] max-h-[72svh] overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[400px]">
        <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-[15px] font-semibold">Pick a routine</DialogTitle>
          </div>
          <div className="relative pt-2">
            <Search className="pointer-events-none absolute left-3 top-[1.35rem] h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search routines..."
              className="h-9 bg-background pl-8 text-sm"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleRoutines.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No routines match this search.</div>
          ) : (
            visibleRoutines.map((routine, index) => (
              <button
                key={routine.id}
                type="button"
                onClick={() => onPick(routine)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted",
                  index < visibleRoutines.length - 1 && "border-b border-border",
                )}
              >
                <RoutineDot tag={routine.tag} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{routine.name}</span>
                  <span className="label-micro mt-0.5 block">
                    {routine.tag} · {routine.exercises.length} exercise{routine.exercises.length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3 sm:justify-center">
          <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={onCreateNew}>
            <Plus className="h-3.5 w-3.5" />
            Create new routine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoutineBuilderDialog({
  exerciseOptions,
  onClose,
  onSave,
  open,
}: {
  exerciseOptions: ExerciseVariationOption[]
  onClose: () => void
  onSave: (routine: Routine) => void
  open: boolean
}) {
  const [name, setName] = useState("")
  const [tag, setTag] = useState<RoutineTag>("push")
  const [exercises, setExercises] = useState<RoutineExercise[]>([])
  const [isExerciseSearchOpen, setIsExerciseSearchOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setTag("push")
      setExercises([])
      setIsExerciseSearchOpen(false)
    }
  }, [open])

  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const canSave = name.trim().length > 0 && exercises.length > 0 && exercises.every((exercise) => exercise.variationId)

  const updateExercise = (exerciseId: string, patch: Partial<RoutineExercise>) => {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    )
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((current) => {
      const target = index + direction

      if (target < 0 || target >= current.length) {
        return current
      }

      const next = current.slice()
      const moving = next[index]
      next[index] = next[target]
      next[target] = moving
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[90] flex h-[90svh] max-h-[90svh] min-h-0 flex-col overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border px-7 pb-4 pt-6 text-left">
          <p className="label-micro">New routine</p>
          <DialogTitle className="text-[23px] font-semibold tracking-[-0.02em]">
            {name.trim() || "Untitled routine"}
          </DialogTitle>
          <p className="font-mono text-xs text-muted-foreground tnum">
            {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · {totalSets} set{totalSets === 1 ? "" : "s"}
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Push day A"
              className="h-10 flex-1 bg-background"
            />
            <div className="flex gap-1.5 overflow-x-auto">
              {ROUTINE_TAGS.map((tagOption) => (
                <button
                  key={tagOption}
                  type="button"
                  onClick={() => setTag(tagOption)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium capitalize transition-colors",
                    tag === tagOption
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <RoutineDot tag={tagOption} />
                  {tagOption}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-5">
          {exercises.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              No exercises yet. Add your first one.
            </div>
          ) : null}

          <div className="space-y-2.5">
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="rounded-[10px] border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-right font-mono text-xs font-semibold text-muted-foreground tnum">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <ExercisePicker
                      exercises={exerciseOptions}
                      fallbackSelection={{
                        equipment: exercise.fallbackEquipment,
                        exerciseName: exercise.fallbackExerciseName,
                        isDefault: exercise.fallbackIsDefault,
                        muscleGroup: exercise.fallbackMuscleGroup,
                        variationName: exercise.fallbackVariationName,
                      }}
                      selectedVariationId={exercise.variationId}
                      onSelect={(variationId) => {
                        const option = exerciseOptions.find((item) => item.id === variationId)

                        updateExercise(exercise.id, {
                          fallbackEquipment: option?.equipment,
                          fallbackExerciseName: option?.exerciseName,
                          fallbackIsDefault: option?.isDefault,
                          fallbackMuscleGroup: option?.muscleGroup,
                          fallbackVariationName: option?.variationName,
                          variationId,
                        })
                      }}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(index, -1)}
                      disabled={index === 0}
                      aria-label="Move exercise up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(index, 1)}
                      disabled={index === exercises.length - 1}
                      aria-label="Move exercise down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))}
                      aria-label="Remove exercise"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 pl-8">
                  <NumberField
                    label="Sets"
                    value={exercise.sets}
                    min={1}
                    onChange={(value) => updateExercise(exercise.id, { sets: Math.max(1, Math.round(value)) })}
                  />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${exercise.id}-reps`} className="label-micro">
                      Reps range
                    </Label>
                    <Input
                      id={`${exercise.id}-reps`}
                      value={exercise.reps}
                      onChange={(event) => updateExercise(exercise.id, { reps: event.target.value })}
                      className="h-9 bg-background text-center font-mono text-sm tnum"
                      placeholder="8-12"
                    />
                  </div>
                  <NumberField
                    label="Kg"
                    value={exercise.weight}
                    min={0}
                    step={0.5}
                    onChange={(value) => updateExercise(exercise.id, { weight: value ? String(value) : "" })}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full border-dashed bg-transparent text-primary hover:bg-muted hover:text-primary"
            onClick={() => setIsExerciseSearchOpen(true)}
            disabled={exerciseOptions.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>
        </div>

        <DialogFooter className="border-t border-border px-7 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) {
                return
              }

              onSave({
                exercises,
                id: createFormId(),
                name: name.trim(),
                tag,
              })
            }}
          >
            Save routine
          </Button>
        </DialogFooter>

        <ExerciseSearchDialog
          existingVariationIds={exercises.map((exercise) => exercise.variationId).filter(Boolean)}
          exerciseOptions={exerciseOptions}
          open={isExerciseSearchOpen}
          onClose={() => setIsExerciseSearchOpen(false)}
          onPick={(option) => {
            setExercises((current) => [
              ...current,
              {
                ...createEmptyRoutineExercise(),
                fallbackEquipment: option.equipment,
                fallbackExerciseName: option.exerciseName,
                fallbackIsDefault: option.isDefault,
                fallbackMuscleGroup: option.muscleGroup,
                fallbackVariationName: option.variationName,
                variationId: option.id,
              },
            ])
            setIsExerciseSearchOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function ExerciseSearchDialog({
  existingVariationIds,
  exerciseOptions,
  onClose,
  onPick,
  open,
}: {
  existingVariationIds: string[]
  exerciseOptions: ExerciseVariationOption[]
  onClose: () => void
  onPick: (option: ExerciseVariationOption) => void
  open: boolean
}) {
  const [query, setQuery] = useState("")
  const [muscleGroup, setMuscleGroup] = useState("all")
  const existingSet = useMemo(() => new Set(existingVariationIds), [existingVariationIds])
  const muscleGroups = useMemo(
    () => ["all", ...Array.from(new Set(exerciseOptions.map((option) => option.muscleGroup))).sort((left, right) => left.localeCompare(right))],
    [exerciseOptions],
  )
  const visibleExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return exerciseOptions
      .slice()
      .sort((left, right) => {
        const nameComparison = left.exerciseName.localeCompare(right.exerciseName)

        if (nameComparison !== 0) {
          return nameComparison
        }

        return left.variationName.localeCompare(right.variationName)
      })
      .filter((option) => {
        if (muscleGroup !== "all" && option.muscleGroup !== muscleGroup) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        return [
          option.exerciseName,
          option.variationName,
          option.name,
          option.muscleGroup,
          option.equipment ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      })
  }, [exerciseOptions, muscleGroup, query])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setMuscleGroup("all")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[110] flex h-[82svh] max-h-[82svh] min-h-0 flex-col overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[480px]">
        <DialogHeader className="border-b border-border px-6 pb-3 pt-5 text-left">
          <DialogTitle className="text-xl font-semibold tracking-[-0.01em]">Add exercise</DialogTitle>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="h-10 rounded-[4px] bg-background pl-9 text-sm focus-visible:ring-primary/30"
              autoFocus
            />
          </div>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {muscleGroups.map((group) => {
              const active = muscleGroup === group

              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setMuscleGroup(group)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border px-3 text-sm font-medium capitalize transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {group === "all" ? "All" : group}
                </button>
              )
            })}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleExercises.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">No exercises match this search.</div>
          ) : (
            visibleExercises.map((option) => {
              const added = existingSet.has(option.id)

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={added}
                  onClick={() => onPick(option)}
                  className={cn(
                    "flex w-full items-center gap-4 border-b border-border px-6 py-3 text-left transition-colors",
                    added ? "cursor-default opacity-55" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{option.exerciseName}</span>
                    <span className="label-micro mt-0.5 block truncate">
                      {option.muscleGroup} · {option.equipment || "Bodyweight"}
                    </span>
                  </span>
                  {added ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-success">Added</span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3 sm:justify-center">
          <Button type="button" variant="ghost" size="sm" className="text-primary hover:text-primary" disabled>
            <Plus className="h-3.5 w-3.5" />
            Create custom exercise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NumberField({
  label,
  min,
  onChange,
  step = 1,
  value,
}: {
  label: string
  min?: number
  onChange: (value: number) => void
  step?: number
  value: number | string
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="label-micro">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        className="h-9 bg-background text-center font-mono text-sm tnum"
      />
    </div>
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
  const { isLoading: authLoading, session } = useAuth()
  const hasInitialEditorData = initialExerciseOptions.length > 0 || initialTraineeOptions.length > 0
  const adjustForTraineeId = programId ? searchParams.get("adjustTrainee") ?? undefined : undefined
  const isAdjustMode = Boolean(programId && adjustForTraineeId)

  const [programName, setProgramName] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("8")
  const [daysPerWeek, setDaysPerWeek] = useState("4")
  const [difficulty, setDifficulty] = useState<CoachProgram["difficulty"]>("beginner")
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseVariationOption[]>(initialExerciseOptions)
  const [traineeOptions, setTraineeOptions] = useState<CoachTrainee[]>(initialTraineeOptions)
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<string[]>([])
  const [routineLibrary, setRoutineLibrary] = useState<Routine[]>([])
  const [schedule, setSchedule] = useState<Schedule>(() => makeEmptySchedule(8, 4))
  const [activeWeek, setActiveWeek] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<PickerSlot | null>(null)
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [clientQuery, setClientQuery] = useState("")
  const [isLoadingPage, setIsLoadingPage] = useState(programId ? true : !hasInitialEditorData)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.access_token) {
      if (!authLoading) {
        setIsLoadingPage(false)
      }

      return
    }

    let cancelled = false

    const loadPage = async () => {
      setIsLoadingPage(programId ? true : !hasInitialEditorData)
      setError(null)

      try {
        const [exercises, exerciseLibrary, program, trainees] = await Promise.all([
          fetchExercises(session.access_token),
          fetchExerciseLibrary(session.access_token),
          programId ? fetchCoachProgram(session.access_token, programId) : Promise.resolve(null),
          fetchCoachTrainees(session.access_token),
        ])

        if (cancelled) {
          return
        }

        const fallbackExerciseOptions = flattenExerciseLibraryToVariationOptions(exerciseLibrary)
        const resolvedExerciseOptions = mergeExerciseOptions(exercises, fallbackExerciseOptions)
        const nextExerciseOptions =
          resolvedExerciseOptions.length > 0
            ? mergeExerciseOptions(initialExerciseOptions, resolvedExerciseOptions)
            : initialExerciseOptions
        const nextTraineeOptions = trainees.length > 0 ? trainees : initialTraineeOptions

        setExerciseOptions(nextExerciseOptions)
        setTraineeOptions(nextTraineeOptions)

        if (program) {
          const nextWeeks = clampWeeks(program.duration || 8)
          const nextDaysPerWeek = clampDaysPerWeek(program.workoutsPerWeek || program.workouts.length || 4)
          const mapped = mapProgramToSchedule(program, nextWeeks, nextDaysPerWeek, nextExerciseOptions)

          setProgramName(program.name)
          setDescription(program.description ?? "")
          setDuration(String(nextWeeks))
          setDaysPerWeek(String(nextDaysPerWeek))
          setDifficulty(program.difficulty)
          setSelectedTraineeIds(
            adjustForTraineeId
              ? [adjustForTraineeId]
              : (program.assignedTo ?? program.assignedTrainees.map((trainee) => trainee.id)),
          )
          setRoutineLibrary(mapped.routines)
          setSchedule(mapped.schedule)
          setActiveWeek(0)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu program.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false)
        }
      }
    }

    void loadPage()

    return () => {
      cancelled = true
    }
  }, [adjustForTraineeId, authLoading, initialExerciseOptions, initialTraineeOptions, programId, session?.access_token, hasInitialEditorData])

  const totalWeeks = Number(duration) || 8
  const totalDaysPerWeek = Number(daysPerWeek) || 4
  const filledSessions = schedule.reduce(
    (sum, week) => sum + week.filter((slot) => Boolean(slot?.routine?.exercises.length)).length,
    0,
  )
  const totalProgramSlots = schedule.reduce((sum, week) => sum + week.filter((slot) => slot !== null).length, 0)
  const completion = totalProgramSlots > 0 ? Math.min(100, Math.round((filledSessions / totalProgramSlots) * 100)) : 0
  const canSave = programName.trim().length > 0 && filledSessions > 0 && !isSaving
  const activeWeekSlots = schedule[activeWeek] ?? schedule[0] ?? []

  const filteredTrainees = useMemo(() => {
    const normalized = clientQuery.trim().toLowerCase()

    if (!normalized) {
      return traineeOptions
    }

    return traineeOptions.filter((trainee) =>
      [trainee.name, trainee.email, trainee.phone ?? ""].join(" ").toLowerCase().includes(normalized),
    )
  }, [clientQuery, traineeOptions])

  const handleDurationChange = (nextValue: string) => {
    const nextWeeks = Number(nextValue)

    setDuration(nextValue)
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
    setNotice(`Copied week ${activeWeek + 1} to all weeks.`)
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
                throw new Error(
                  `Hãy chọn bài tập cho ${routine.name.trim() || `Week ${weekIndex + 1} day ${dayIndex + 1}`} / bài tập ${exerciseIndex + 1}.`,
                )
              }

              const repTarget = parseRepTargetText(exercise.reps)

              if (!repTarget) {
                throw new Error(
                  `Reps range không hợp lệ ở ${routine.name.trim() || `Week ${weekIndex + 1} day ${dayIndex + 1}`} / bài tập ${exerciseIndex + 1}. Dùng dạng 8-12 hoặc 10.`,
                )
              }

              const parsedWeight = Number(exercise.weight)

              return {
                reps: repTarget.reps,
                repsMin: repTarget.repsMin,
                sets: exercise.sets,
                variationId: exercise.variationId,
                weight:
                  exercise.weight.trim() && Number.isFinite(parsedWeight)
                    ? Math.max(0, parsedWeight)
                    : undefined,
              }
            }),
            name: routine.name.trim() || `Week ${weekIndex + 1} ${DAY_OPTIONS[dayIndex].label}`,
            scheduledDay: DAY_OPTIONS[dayIndex].scheduledDay,
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
      workouts,
    }
  }

  const handleSaveProgram = async () => {
    if (!session?.access_token || !canSave) {
      return
    }

    let payload: CreateCoachProgramInput

    try {
      payload = buildProgramPayload()
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Không thể chuẩn hóa dữ liệu program.")
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const savedProgram =
        programId && adjustForTraineeId
          ? await adjustCoachProgram(session.access_token, programId, adjustForTraineeId, payload)
          : programId
            ? await updateCoachProgram(session.access_token, programId, payload)
            : await createCoachProgram(session.access_token, payload)

      if (onSaved || onClose) {
        onSaved?.(savedProgram)
        onClose?.()
        router.refresh()
        return savedProgram
      }

      router.push(adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs")
      router.refresh()

      return savedProgram
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu program.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingPage) {
    return <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">Loading program...</div>
  }

  return (
    <div className="fixed inset-0 z-[60] flex min-h-screen items-start justify-center overflow-y-auto bg-foreground/45 px-0 py-0 backdrop-blur-sm md:px-1 md:py-1" aria-busy={isSaving}>
      {isSaving ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[14px] border border-border bg-card p-6 text-center shadow-[0_24px_60px_-12px_rgba(13,13,11,0.25)]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h2 className="mt-5 text-xl font-semibold">Saving program...</h2>
            <p className="mt-2 text-sm text-muted-foreground">Updating workouts, rep targets, and assignments.</p>
          </div>
        </div>
      ) : null}

      <div className="flex w-full max-w-[880px] flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_24px_60px_-12px_rgba(13,13,11,0.18)]">
        <div className="border-b border-border px-7 pb-[18px] pt-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="label-micro mb-1.5">{isAdjustMode ? "Adjust program" : programId ? "Edit program" : "New program"}</p>
              <h1 className="truncate text-[23px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {programName.trim() || "Untitled program"}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground tnum">
                {totalWeeks} weeks · {totalDaysPerWeek} days/week · {filledSessions}/{totalProgramSlots} sessions filled
              </p>
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

          <div className="grid gap-2.5 md:grid-cols-[1.35fr_0.82fr_0.9fr_1fr]">
            <Input
              value={programName}
              onChange={(event) => setProgramName(event.target.value)}
              placeholder="e.g. Strength block - 12w"
              className="bg-background"
            />
            <Select value={duration} onValueChange={handleDurationChange}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {WEEK_OPTIONS.map((weekCount) => (
                  <SelectItem key={weekCount} value={String(weekCount)}>
                    {weekCount} weeks
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={daysPerWeek} onValueChange={handleDaysPerWeekChange}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {DAYS_PER_WEEK_OPTIONS.map((dayCount) => (
                  <SelectItem key={dayCount} value={String(dayCount)}>
                    {dayCount} days/week
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={(value) => setDifficulty(value as CoachProgram["difficulty"])}>
              <SelectTrigger className="bg-background capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option} className="capitalize">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 grid gap-2.5 md:grid-cols-[1fr_auto]">
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description (e.g. Heavy compounds Mon/Thu, accessory volume Tue/Sat)"
              className="h-9 bg-background text-[13px]"
            />
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => setIsAssignDialogOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Assign clients
              {selectedTraineeIds.length > 0 ? (
                <Badge variant="micro" className="ml-1 bg-muted">
                  {selectedTraineeIds.length}
                </Badge>
              ) : null}
            </Button>
          </div>
        </div>

        <div className="flex min-h-[66px] flex-wrap items-center gap-3 border-b border-border bg-muted px-7 py-3">
          <p className="label-micro">Week</p>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
            {Array.from({ length: totalWeeks }).map((_, index) => {
              const week = schedule[index] ?? []
              const weekTotal = week.filter((slot) => slot !== null).length
              const weekFilled = week.filter((slot) => Boolean(slot?.routine?.exercises.length)).length
              const isActive = activeWeek === index
              const isComplete = weekTotal > 0 && weekFilled === weekTotal

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveWeek(index)}
                  className={cn(
                    "flex min-w-[38px] flex-col items-center rounded border px-2.5 py-1 font-mono text-xs transition-colors duration-150 ease-[cubic-bezier(.2,.7,.2,1)]",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-background text-foreground hover:bg-muted",
                  )}
                >
                  w{index + 1}
                  <span
                    className={cn(
                      "mt-1 h-1 w-1 rounded-full",
                      isComplete ? "bg-success" : isActive ? "bg-muted-foreground" : "bg-muted-foreground/30",
                    )}
                  />
                </button>
              )
            })}
          </div>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={copyActiveWeekToAll}>
            <Copy className="h-3.5 w-3.5" />
            Copy w{activeWeek + 1} to all
          </Button>
        </div>

        <div className="px-7 py-5">
          {error ? (
            <div className="mb-4 rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mb-4 rounded-[10px] border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-7">
            {DAY_OPTIONS.map((day, dayIndex) => (
              <SessionSlot
                key={day.scheduledDay}
                dayLabel={day.label}
                slot={activeWeekSlots[dayIndex] ?? null}
                onClick={() => {
                  if (activeWeekSlots[dayIndex] === null) {
                    toggleRestDay(activeWeek, dayIndex)
                    return
                  }

                  setPickerSlot({ dayIndex, weekIndex: activeWeek })
                }}
                onToggleRest={() => toggleRestDay(activeWeek, dayIndex)}
              />
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="label-micro">Program completion</p>
              <span className="font-mono text-[11px] text-muted-foreground tnum">{completion}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div
                className={cn("h-full transition-[width] duration-200", completion === 100 ? "bg-success" : "bg-primary")}
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Tap a session to swap routine · tap a rest day to add a session · use "Copy w{activeWeek + 1} to all" if every week is identical.
            </p>
          </div>
        </div>

        <div className="flex min-h-[68px] flex-col gap-2 border-t border-border bg-card px-7 py-4 sm:flex-row sm:justify-end">
          {onClose ? (
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onClose}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" asChild className="w-full sm:w-auto">
              <Link href={adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs"}>Cancel</Link>
            </Button>
          )}
          <Button type="button" className="w-full sm:w-auto" onClick={() => void handleSaveProgram()} disabled={!canSave}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : programId ? "Save changes" : "Save program"}
          </Button>
        </div>
      </div>

      <RoutinePickerDialog
        open={Boolean(pickerSlot) && !isCreatingRoutine}
        library={routineLibrary}
        onClose={() => setPickerSlot(null)}
        onPick={assignRoutineToPickerSlot}
        onCreateNew={() => setIsCreatingRoutine(true)}
      />

      <RoutineBuilderDialog
        open={isCreatingRoutine}
        exerciseOptions={exerciseOptions}
        onClose={() => setIsCreatingRoutine(false)}
        onSave={(routine) => {
          setRoutineLibrary((current) => [routine, ...current])
          assignRoutineToPickerSlot(routine)
          setIsCreatingRoutine(false)
        }}
      />

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="z-[90] max-h-[80svh] overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-xl font-semibold">Assign clients</DialogTitle>
            <div className="relative pt-2">
              <Search className="pointer-events-none absolute left-3 top-[1.35rem] h-4 w-4 text-muted-foreground" />
              <Input
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
                placeholder="Search clients..."
                className="bg-background pl-9"
              />
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            {filteredTrainees.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No clients found.</div>
            ) : (
              <div className="space-y-2">
                {filteredTrainees.map((trainee) => {
                  const checked = selectedTraineeIds.includes(trainee.id)

                  return (
                    <label
                      key={trainee.id}
                      className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-border px-3 py-2.5 transition-colors hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleTraineeAssignment(trainee.id, Boolean(value))}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={trainee.avatar ?? undefined} alt={trainee.name} />
                        <AvatarFallback className="bg-foreground text-[11px] text-background">
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
              {selectedTraineeIds.length} selected
            </span>
            <Button type="button" variant="ghost" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setIsAssignDialogOpen(false)}>
              Assign {selectedTraineeIds.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
