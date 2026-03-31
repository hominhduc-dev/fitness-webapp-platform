"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Dumbbell,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { downloadCoachProgramTemplate, importCoachProgramTemplate } from "@/components/coach/program-excel"
import { ExercisePicker } from "@/components/exercises/exercise-picker"
import { useAuth } from "@/components/providers/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  adjustCoachProgram,
  createCoachProgram,
  deleteCoachProgram,
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

type WorkoutExerciseForm = {
  fallbackEquipment?: string
  fallbackExerciseName?: string
  fallbackIsDefault?: boolean
  fallbackMuscleGroup?: string
  fallbackVariationName?: string
  variationId: string
  id: string
  reps: string
  sets: number
  weight: string
}

type WorkoutDay = {
  exercises: WorkoutExerciseForm[]
  id: string
  name: string
  scheduledDay: string
}

type ProgramEditorProps = {
  initialExerciseOptions?: ExerciseVariationOption[]
  initialTraineeOptions?: CoachTrainee[]
  programId?: string
}

const DAY_OPTIONS = [
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
  { label: "Sunday", value: "0" },
]

const EXERCISE_LIBRARY_EMPTY_ERROR = "Chưa có bài tập nào trong thư viện để thêm vào program."

function createFormId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createWorkoutDay(index: number): WorkoutDay {
  return {
    exercises: [],
    id: createFormId(),
    name: `Day ${index + 1}`,
    scheduledDay: String((index + 1) % 7),
  }
}

function createWorkoutExerciseForm(): WorkoutExerciseForm {
  return {
    variationId: "",
    id: createFormId(),
    reps: "8-12",
    sets: 3,
    weight: "",
  }
}

function estimateWorkoutDuration(exercises: WorkoutExerciseForm[]) {
  if (exercises.length === 0) {
    return 30
  }

  return Math.max(30, Math.round(exercises.reduce((sum, exercise) => sum + exercise.sets * 3, 0)))
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

function buildExerciseFallbackSelection(
  workoutExercise: CoachProgram["workouts"][number]["exercises"][number],
  resolvedOption?: ExerciseVariationOption,
) {
  return {
    fallbackEquipment: resolvedOption?.equipment ?? workoutExercise.variation.equipment,
    fallbackExerciseName: workoutExercise.exercise.name,
    fallbackIsDefault: workoutExercise.variation.isDefault,
    fallbackMuscleGroup: resolvedOption?.muscleGroup ?? workoutExercise.exercise.muscleGroup,
    fallbackVariationName: workoutExercise.variation.name,
  }
}

function mapProgramToWorkoutDays(program: CoachProgram, exerciseOptions: ExerciseVariationOption[]): WorkoutDay[] {
  return program.workouts.map((workout, index) => ({
    exercises: workout.exercises.map((exercise) => {
      const resolvedOption = resolveExerciseOptionForEditor(exercise, exerciseOptions)

      return {
        ...buildExerciseFallbackSelection(exercise, resolvedOption),
        variationId: resolvedOption?.id ?? exercise.variation.id,
        id: exercise.id,
        reps: formatRepTarget({
          reps: exercise.sets[0]?.targetReps ?? 1,
          repsMin: exercise.sets[0]?.targetRepsMin,
        }),
        sets: exercise.sets.length,
        weight: exercise.sets[0]?.weight != null ? String(exercise.sets[0].weight) : "",
      }
    }),
    id: workout.id,
    name: workout.name,
    scheduledDay: String(workout.scheduledDay ?? ((index + 1) % 7)),
  }))
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

function getScheduledDayLabel(scheduledDay: string) {
  return DAY_OPTIONS.find((option) => option.value === scheduledDay)?.label ?? "Unscheduled"
}

function mapImportedWorkoutsToWorkoutDays(workouts: CreateCoachProgramInput["workouts"]): WorkoutDay[] {
  return workouts.map((workout, index) => ({
    exercises: workout.exercises.map((exercise) => ({
      variationId: exercise.variationId,
      id: createFormId(),
      reps: formatRepTarget({
        reps: exercise.reps,
        repsMin: exercise.repsMin,
      }),
      sets: exercise.sets,
      weight: exercise.weight != null ? String(exercise.weight) : "",
    })),
    id: createFormId(),
    name: workout.name || `Day ${index + 1}`,
    scheduledDay: String(workout.scheduledDay ?? ((index + 1) % 7)),
  }))
}

function SortableWorkoutExerciseCard({
  exercise,
  exerciseOptions,
  onRemove,
  onUpdate,
}: {
  exercise: WorkoutExerciseForm
  exerciseOptions: ExerciseVariationOption[]
  onRemove: () => void
  onUpdate: (patch: Partial<WorkoutExerciseForm>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.92)_100%)] p-3 shadow-sm transition-all ${
        isDragging ? "scale-[1.01] border-primary/40 shadow-md ring-2 ring-primary/15" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-2xl border border-border/70 bg-background/90 text-muted-foreground hover:border-primary/30 hover:text-foreground sm:h-11 sm:w-11"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <ExercisePicker
            selectedVariationId={exercise.variationId}
            exercises={exerciseOptions}
            fallbackSelection={{
              equipment: exercise.fallbackEquipment,
              exerciseName: exercise.fallbackExerciseName,
              isDefault: exercise.fallbackIsDefault,
              muscleGroup: exercise.fallbackMuscleGroup,
              variationName: exercise.fallbackVariationName,
            }}
            onSelect={(variationId) => {
              const selectedOption = exerciseOptions.find((option) => option.id === variationId)

              onUpdate({
                fallbackEquipment: selectedOption?.equipment,
                fallbackExerciseName: selectedOption?.exerciseName,
                fallbackIsDefault: selectedOption?.isDefault,
                fallbackMuscleGroup: selectedOption?.muscleGroup,
                fallbackVariationName: selectedOption?.variationName,
                variationId,
              })
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 pl-[3.25rem] sm:gap-3 sm:pl-[3.5rem]">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:gap-3">
          <div className="flex h-10 min-w-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/90 px-1.5 sm:h-11 sm:px-2">
            <Label htmlFor={`${exercise.id}-sets`} className="sr-only">
              Sets
            </Label>
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
              Sets
            </span>
            <Input
              id={`${exercise.id}-sets`}
              type="number"
              value={exercise.sets}
              min={1}
              onChange={(event) => onUpdate({ sets: Number(event.target.value) || 1 })}
              className="h-5 w-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
          </div>

          <div className="flex h-10 min-w-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/90 px-1.5 sm:h-11 sm:px-2">
            <Label htmlFor={`${exercise.id}-reps`} className="sr-only">
              Reps
            </Label>
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
              Reps
            </span>
            <Input
              id={`${exercise.id}-reps`}
              type="text"
              value={exercise.reps}
              inputMode="numeric"
              onChange={(event) => onUpdate({ reps: event.target.value })}
              placeholder="8-12"
              className="h-5 w-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
          </div>

          <div className="flex h-10 min-w-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/90 px-1.5 sm:h-11 sm:px-2">
            <Label htmlFor={`${exercise.id}-weight`} className="sr-only">
              Weight
            </Label>
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
              Weight
            </span>
            <Input
              id={`${exercise.id}-weight`}
              type="number"
              value={exercise.weight}
              min={0}
              step="0.5"
              onChange={(event) => onUpdate({ weight: event.target.value })}
              placeholder="0"
              className="h-5 w-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="h-10 w-10 shrink-0 rounded-2xl border border-transparent text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive sm:h-11 sm:w-11"
          aria-label="Remove exercise"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function ProgramEditor({
  initialExerciseOptions = [],
  initialTraineeOptions = [],
  programId,
}: ProgramEditorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading: authLoading, session } = useAuth()
  const hasInitialEditorData = initialExerciseOptions.length > 0 || initialTraineeOptions.length > 0
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [programName, setProgramName] = useState("")
  const [description, setDescription] = useState("")
  const [duration, setDuration] = useState("8")
  const [difficulty, setDifficulty] = useState("beginner")
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseVariationOption[]>(initialExerciseOptions)
  const [traineeOptions, setTraineeOptions] = useState<CoachTrainee[]>(initialTraineeOptions)
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<string[]>([])
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([])
  const [expandedWorkoutDayIds, setExpandedWorkoutDayIds] = useState<Record<string, boolean>>({})
  const [currentProgram, setCurrentProgram] = useState<CoachProgram | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(programId ? true : !hasInitialEditorData)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importInputKey, setImportInputKey] = useState(0)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [isImportingWorkbook, setIsImportingWorkbook] = useState(false)
  const adjustForTraineeId = programId ? searchParams.get("adjustTrainee") ?? undefined : undefined
  const isAdjustMode = Boolean(programId && adjustForTraineeId)

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
          setCurrentProgram(program)
          setProgramName(program.name)
          setDescription(program.description ?? "")
          setDuration(String(program.duration))
          setDifficulty(program.difficulty)
          setSelectedTraineeIds(
            adjustForTraineeId
              ? [adjustForTraineeId]
              : (program.assignedTo ?? program.assignedTrainees.map((trainee) => trainee.id)),
          )
          setWorkoutDays(mapProgramToWorkoutDays(program, nextExerciseOptions))
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
  }, [adjustForTraineeId, authLoading, initialExerciseOptions, initialTraineeOptions, programId, session?.access_token])

  useEffect(() => {
    if (programId || workoutDays.length > 0 || exerciseOptions.length === 0 || isLoadingPage) {
      return
    }

    const initialDay = createWorkoutDay(0)
    setWorkoutDays([initialDay])
    setExpandedWorkoutDayIds({ [initialDay.id]: true })
  }, [exerciseOptions, isLoadingPage, programId, workoutDays.length])

  useEffect(() => {
    setExpandedWorkoutDayIds((current) => {
      const next = { ...current }
      let changed = false
      const activeDayIds = new Set(workoutDays.map((day) => day.id))

      workoutDays.forEach((day) => {
        if (!(day.id in next)) {
          next[day.id] = false
          changed = true
        }
      })

      Object.keys(next).forEach((dayId) => {
        if (!activeDayIds.has(dayId)) {
          delete next[dayId]
          changed = true
        }
      })

      return changed ? next : current
    })
  }, [workoutDays])

  const addWorkoutDay = () => {
    setWorkoutDays((current) => {
      const nextDay = createWorkoutDay(current.length)

      setExpandedWorkoutDayIds((expanded) => ({
        ...expanded,
        [nextDay.id]: true,
      }))

      return [...current, nextDay]
    })
  }

  const addExercise = (dayId: string) => {
    setError((current) => (current === EXERCISE_LIBRARY_EMPTY_ERROR ? null : current))
    
    if (exerciseOptions.length === 0) {
      setError(EXERCISE_LIBRARY_EMPTY_ERROR)
      return
    }

    setWorkoutDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: [
              ...day.exercises,
                createWorkoutExerciseForm(),
              ],
            }
          : day,
      ),
    )
  }

  const removeExercise = (dayId: string, exerciseId: string) => {
    setWorkoutDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.filter((exercise) => exercise.id !== exerciseId),
            }
          : day,
      ),
    )
  }

  const removeDay = (dayId: string) => {
    setWorkoutDays((current) => current.filter((day) => day.id !== dayId))
  }

  const toggleWorkoutDayExpanded = (dayId: string) => {
    setExpandedWorkoutDayIds((current) => ({
      ...current,
      [dayId]: !(current[dayId] ?? false),
    }))
  }

  const updateExerciseInDay = (dayId: string, exerciseId: string, patch: Partial<WorkoutExerciseForm>) => {
    setWorkoutDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.map((entry) => (entry.id === exerciseId ? { ...entry, ...patch } : entry)),
            }
          : day,
      ),
    )
  }

  const handleDayExerciseDragEnd = (dayId: string) => (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    setWorkoutDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) {
          return day
        }

        const oldIndex = day.exercises.findIndex((exercise) => exercise.id === active.id)
        const newIndex = day.exercises.findIndex((exercise) => exercise.id === over.id)

        if (oldIndex < 0 || newIndex < 0) {
          return day
        }

        return {
          ...day,
          exercises: arrayMove(day.exercises, oldIndex, newIndex),
        }
      }),
    )
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const toggleTraineeAssignment = (traineeId: string, checked: boolean) => {
    if (isAdjustMode && adjustForTraineeId) {
      setSelectedTraineeIds(checked ? [adjustForTraineeId] : [])
      return
    }

    setSelectedTraineeIds((current) =>
      checked ? Array.from(new Set([...current, traineeId])) : current.filter((id) => id !== traineeId),
    )
  }

  const buildProgramPayload = (): CreateCoachProgramInput => ({
    assignToUserIds: selectedTraineeIds,
    description: description.trim() || undefined,
    difficulty: difficulty as "beginner" | "intermediate" | "advanced",
    duration: Number(duration),
    name: programName.trim(),
    workouts: workoutDays
      .map((day, index) => ({
        duration: estimateWorkoutDuration(day.exercises),
        exercises: day.exercises.map((exercise, exerciseIndex) => {
          if (!exercise.variationId.trim()) {
            throw new Error(
              `Hãy chọn bài tập cho ${day.name.trim() || `Day ${index + 1}`} / bài tập ${exerciseIndex + 1}.`,
            )
          }

          const parsedWeight = Number(exercise.weight)
          const repTarget = parseRepTargetText(exercise.reps)

          if (!repTarget) {
            throw new Error(
              `Reps range không hợp lệ ở ${day.name.trim() || `Day ${index + 1}`} / bài tập ${exerciseIndex + 1}. Dùng dạng 8-12 hoặc 10.`,
            )
          }

          return {
            reps: repTarget.reps,
            repsMin: repTarget.repsMin,
            variationId: exercise.variationId,
            sets: exercise.sets,
            weight:
              exercise.weight.trim() && Number.isFinite(parsedWeight)
                ? Math.max(0, parsedWeight)
                : undefined,
          }
        }),
        name: day.name.trim() || `Day ${index + 1}`,
        scheduledDay: Number(day.scheduledDay),
      }))
      .filter((day) => day.exercises.length > 0),
  })

  const handleSaveProgram = async () => {
    if (!session?.access_token) {
      return
    }

    let payload: CreateCoachProgramInput

    try {
      payload = buildProgramPayload()
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Không thể chuẩn hóa rep range cho program.")
      return
    }

    if (!payload.name) {
      setError("Tên chương trình không được để trống.")
      return
    }

    if (payload.workouts.length === 0) {
      setError("Program cần ít nhất một buổi tập có bài tập.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const savedProgram =
        programId && adjustForTraineeId
          ? await adjustCoachProgram(session.access_token, programId, adjustForTraineeId, payload)
          : programId
            ? await updateCoachProgram(session.access_token, programId, payload)
            : await createCoachProgram(session.access_token, payload)

      setCurrentProgram(savedProgram)
      setSelectedTraineeIds(savedProgram.assignedTo ?? savedProgram.assignedTrainees.map((trainee) => trainee.id))

      router.push(adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : `/coach/programs/${savedProgram.id}`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu program.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProgram = async () => {
    if (!session?.access_token || !programId) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteCoachProgram(session.access_token, programId)
      setIsDeleteDialogOpen(false)
      router.push("/coach/programs")
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa program.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true)
    setError(null)
    setNotice(null)

    try {
      await downloadCoachProgramTemplate(exerciseOptions, traineeOptions)
      setNotice("Downloaded Excel template for coach programs.")
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Không thể tạo file mẫu program.")
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsImportingWorkbook(true)
    setError(null)
    setNotice(null)

    try {
      const importedProgram = await importCoachProgramTemplate(file, exerciseOptions, traineeOptions)
      const importedWorkoutDays = mapImportedWorkoutsToWorkoutDays(importedProgram.workouts)

      if (typeof importedProgram.name === "string") {
        setProgramName(importedProgram.name)
      }

      if (typeof importedProgram.description === "string") {
        setDescription(importedProgram.description)
      }

      if (typeof importedProgram.duration === "number") {
        setDuration(String(importedProgram.duration))
      }

      if (importedProgram.difficulty) {
        setDifficulty(importedProgram.difficulty)
      }

      if (importedProgram.assignToUserIds && !isAdjustMode) {
        setSelectedTraineeIds(importedProgram.assignToUserIds)
      }

      setWorkoutDays(importedWorkoutDays)
      setExpandedWorkoutDayIds(
        Object.fromEntries(importedWorkoutDays.map((day) => [day.id, true])),
      )
      setImportFileName(file.name)
      setNotice(`Imported ${importedWorkoutDays.length} workout day${importedWorkoutDays.length === 1 ? "" : "s"} from ${file.name}. Review the form, then save the program.`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Không thể import program từ Excel.")
    } finally {
      setImportInputKey((current) => current + 1)
      setIsImportingWorkbook(false)
    }
  }

  if (isLoadingPage) {
    return <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">Loading program...</div>
  }

  const selectedTrainees = traineeOptions.filter((trainee) => selectedTraineeIds.includes(trainee.id))
  const adjustTrainee = adjustForTraineeId ? traineeOptions.find((trainee) => trainee.id === adjustForTraineeId) : undefined

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6 md:px-6" aria-busy={isSaving}>
      {isSaving ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.94)_100%)] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">Saving program...</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Updating workouts, rep ranges, and trainee assignments. Please keep this tab open.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Dumbbell className="h-4 w-4" />
                  <span className="text-sm font-semibold">{workoutDays.length}</span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {workoutDays.length === 1 ? "Workout Day" : "Workout Days"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-semibold">{selectedTraineeIds.length}</span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {selectedTraineeIds.length === 1 ? "Trainee" : "Trainees"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Program</p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {programName.trim() || (programId ? "Current Program" : "New Program")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-3 sm:mb-6">
        <Link href={adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs"}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold sm:text-2xl">
            {isAdjustMode ? "Adjust plan for trainee" : programId ? currentProgram?.name || "Program Details" : "Create new program"}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {isAdjustMode
              ? "Create a trainee-specific copy without changing the original shared program."
              : programId
                ? "Update or remove this saved program"
                : "Save directly to Prisma/Postgres"}
          </p>
        </div>
      </div>

      {isAdjustMode && adjustTrainee ? (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Adjust mode</p>
          <p className="mt-2 text-sm text-foreground">
            You are creating a dedicated plan copy for <span className="font-semibold">{adjustTrainee.name}</span>.
            Other trainees assigned to the original program will stay unchanged.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {selectedTrainees.length ? (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold sm:text-lg">Selected Trainees</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {selectedTrainees.map((trainee) => (
              <Link
                key={trainee.id}
                href={`/coach/trainees/${trainee.id}`}
                className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:border-primary/30"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xs">{getInitials(trainee.name)}</AvatarFallback>
                </Avatar>
                <span>{trainee.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4 sm:space-y-6">
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <h2 className="text-base font-semibold mb-4 sm:text-lg">Basic Information</h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm">
                      Program name
                    </Label>
                    <Input
                      id="name"
                      value={programName}
                      onChange={(event) => setProgramName(event.target.value)}
                      placeholder="e.g. Beginner Strength Builder"
                      className="mt-1.5 bg-muted/30 border-border"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Short summary of the program..."
                      className="mt-1.5 bg-muted/30 border-border min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="duration" className="text-sm">
                        Duration (weeks)
                      </Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="mt-1.5 bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {[4, 6, 8, 10, 12, 16].map((weekCount) => (
                            <SelectItem key={weekCount} value={String(weekCount)}>
                              {weekCount} weeks
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="difficulty" className="text-sm">
                        Difficulty
                      </Label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger className="mt-1.5 bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold sm:text-lg">Excel Import</h2>
                  <p className="text-sm text-muted-foreground">
                    Download the template, fill it offline, then import it to replace the current form values before saving.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported files: .xlsx, .xls, .csv. Use <span className="font-medium">reps_range</span> like <span className="font-medium">8-12</span> or <span className="font-medium">10</span>. Variation matching prefers <span className="font-medium">variation_id</span>, then falls back to <span className="font-medium">exercise_name + variation_name</span>.
                  </p>
                  {importFileName ? (
                    <p className="text-xs font-medium text-foreground">Last imported file: {importFileName}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    key={importInputKey}
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(event) => void handleImportFile(event)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 bg-transparent"
                    onClick={() => void handleDownloadTemplate()}
                    disabled={isDownloadingTemplate || isImportingWorkbook || exerciseOptions.length === 0}
                  >
                    {isDownloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 bg-transparent"
                    onClick={() => importInputRef.current?.click()}
                    disabled={isImportingWorkbook || isDownloadingTemplate || exerciseOptions.length === 0}
                  >
                    {isImportingWorkbook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Import Excel
                  </Button>
                </div>
              </div>
            </div>

              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold sm:text-lg">
                      {isAdjustMode ? "Assigned trainee" : "Assign To Trainees"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isAdjustMode
                        ? "This adjustment will only be assigned to the selected trainee below."
                        : "Select who should receive this program right after saving."}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {selectedTraineeIds.length} selected
                  </div>
                </div>

                {traineeOptions.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    Chưa có trainee nào được kết nối với coach này.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {traineeOptions.map((trainee) => {
                      const isChecked = selectedTraineeIds.includes(trainee.id)

                      return (
                        <label
                          key={trainee.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                            isChecked
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-muted/20 hover:border-primary/20"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => toggleTraineeAssignment(trainee.id, Boolean(checked))}
                            className="mt-0.5"
                            disabled={isAdjustMode}
                          />
                          <Avatar className="h-10 w-10 border border-primary/20">
                            <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(trainee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{trainee.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{trainee.email}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {trainee.thisWeekWorkouts} workouts this week
                              {trainee.latestWeightKg != null ? ` • ${trainee.latestWeightKg} kg` : ""}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold sm:text-lg">Workout Days</h2>
                    <p className="text-sm text-muted-foreground">
                      Shape each day with the same clean card layout used in the trainee workout builder.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWorkoutDay}
                    className="gap-1.5 rounded-full border-primary/20 bg-background/90 px-4 text-xs sm:text-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add day
                  </Button>
                </div>

                <div className="space-y-5">
                  {workoutDays.map((day, dayIndex) => {
                    const isExpanded = expandedWorkoutDayIds[day.id] ?? false
                    const dayName = day.name.trim() || `Day ${dayIndex + 1}`

                    return (
                    <div
                      key={day.id}
                      className="rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.92)_100%)] p-4 shadow-sm sm:p-5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleWorkoutDayExpanded(day.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-[24px] border border-border/70 bg-background/80 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-background"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/90 text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Workout name
                            </p>
                            <p className="truncate text-base font-semibold sm:text-lg">{dayName}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {getScheduledDayLabel(day.scheduledDay)} • {day.exercises.length}{" "}
                              {day.exercises.length === 1 ? "move" : "moves"} • {estimateWorkoutDuration(day.exercises)} min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:inline-flex">
                            {day.exercises.length} {day.exercises.length === 1 ? "move" : "moves"}
                          </span>
                          <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                            {estimateWorkoutDuration(day.exercises)} min
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isExpanded ? (
                      <>
                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
                        <div className="space-y-2">
                          <Label htmlFor={`${day.id}-name`} className="text-sm">
                            Workout name
                          </Label>
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/90 text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Input
                              id={`${day.id}-name`}
                              value={day.name}
                              onChange={(event) => {
                                setWorkoutDays((current) =>
                                  current.map((item) => (item.id === day.id ? { ...item, name: event.target.value } : item)),
                                )
                              }}
                              placeholder={`Day ${dayIndex + 1}`}
                              className="h-12 rounded-2xl border-border/70 bg-background/90 shadow-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${day.id}-scheduled-day`} className="text-sm">
                            Scheduled day
                          </Label>
                          <Select
                            value={day.scheduledDay}
                            onValueChange={(value) => {
                              setWorkoutDays((current) =>
                                current.map((item) => (item.id === day.id ? { ...item, scheduledDay: value } : item)),
                              )
                            }}
                          >
                            <SelectTrigger
                              id={`${day.id}-scheduled-day`}
                              className="h-12 rounded-2xl border-border/70 bg-background/90"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {DAY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between gap-2 lg:justify-end">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                              {day.exercises.length} {day.exercises.length === 1 ? "move" : "moves"}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              {estimateWorkoutDuration(day.exercises)} min
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDay(day.id)}
                            className="h-11 w-11 rounded-2xl border border-transparent text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                            aria-label="Remove day"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,255,0.98)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-3 shadow-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold">Exercises</h3>
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                                {day.exercises.length} {day.exercises.length === 1 ? "move" : "moves"}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Choose exercises, drag to reorder them, and set the prescription for this workout day.
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addExercise(day.id)}
                            className="gap-2 rounded-full border-primary/20 bg-background/90 px-4"
                          >
                            <Plus className="h-4 w-4" />
                            Add exercise
                          </Button>
                        </div>

                        {exerciseOptions.length === 0 ? (
                          <div className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Thư viện bài tập chưa tải được. Vui lòng tải lại trang hoặc kiểm tra lại dữ liệu exercise của coach.
                          </div>
                        ) : null}

                        {day.exercises.length > 0 ? (
                          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDayExerciseDragEnd(day.id)}>
                            <SortableContext items={day.exercises.map((exercise) => exercise.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-3">
                                {day.exercises.map((exercise) => (
                                  <SortableWorkoutExerciseCard
                                    key={exercise.id}
                                    exercise={exercise}
                                    exerciseOptions={exerciseOptions}
                                    onUpdate={(patch) => updateExerciseInDay(day.id, exercise.id, patch)}
                                    onRemove={() => removeExercise(day.id, exercise.id)}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-8 text-center">
                            <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">No exercises in this day yet...</p>
                          </div>
                        )}
                      </div>
                      </>
                      ) : null}
                    </div>
                    )
                  })}

                  {workoutDays.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-border px-4 py-10 text-center">
                      <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No workout days yet...</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {programId && !isAdjustMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isDeleting || isSaving}
                  >
                    {isDeleting ? "Deleting..." : "Delete Program"}
                  </Button>
                ) : null}
                <Link href={adjustForTraineeId ? `/coach/trainees/${adjustForTraineeId}` : "/coach/programs"} className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    Cancel
                  </Button>
                </Link>
                <Button type="button" className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90" onClick={() => void handleSaveProgram()} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? "Saving..." : isAdjustMode ? "Save Adjusted Plan" : programId ? "Update Program" : "Save Program"}
                </Button>
              </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this program?</DialogTitle>
            <DialogDescription>
              This will permanently remove the program and all workout days inside it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteProgram()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
