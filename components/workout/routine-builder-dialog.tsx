"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Dumbbell, X } from "lucide-react"

import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { RoutineExerciseCard } from "@/components/workout/routine-exercise-card"
import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCreateWorkout, useUpdateWorkout } from "@/lib/queries/workouts"
import { useExercises } from "@/lib/queries/exercises"
import { buildMuscleProfileHighlights } from "@/lib/fitness/muscle-map"
import { normalizeSetIntensityAssignments, readSetIntensityAssignments, type SetIntensityAssignment } from "@/lib/workout/intensity-tag"
import type { AppMessages } from "@/lib/i18n/messages"
import type { ExerciseActivityType, ExerciseVariationOption, MuscleSlug, Workout } from "@/lib/types"
import { cn } from "@/lib/utils"
import { parseRepTargetText, formatRepTarget } from "@/lib/workout-reps"

// ─── Types ──────────────────────────────────────────────────────────────────

type RoutineTag = "push" | "pull" | "legs" | "upper" | "lower" | "full"

export type RoutineExerciseDraft = {
  id: string
  variationId: string
  displayName: string
  media?: import("@/lib/types").ExerciseMedia
  muscleGroup: string
  activityType?: ExerciseActivityType
  primaryMuscles?: MuscleSlug[]
  secondaryMuscles?: MuscleSlug[]
  equipment?: string
  sets: number
  reps: string
  weight: string
  rir: string
  restTime?: string
  notes?: string
  /** Methods the coach prescribed per set; sets left out are normal sets. */
  setIntensityTags?: SetIntensityAssignment[]
}

export type RoutineDraftData = {
  id?: string
  name: string
  tag: RoutineTag
  exercises: RoutineExerciseDraft[]
}

export type RoutineBuilderDialogProps = {
  // — uncontrolled / trainee mode —
  trigger?: React.ReactNode
  workoutToEdit?: Workout
  onWorkoutSaved?: (workout: Workout, previousWorkout?: Workout) => void
  refreshOnSuccess?: boolean
  // — controlled / coach draft mode —
  open?: boolean
  onOpenChange?: (open: boolean) => void
  draftToEdit?: RoutineDraftData
  onSaveDraft?: (data: RoutineDraftData) => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROUTINE_TAGS: RoutineTag[] = ["push", "pull", "legs", "upper", "lower", "full"]

const TAG_DOT: Record<RoutineTag, string> = {
  full:  "var(--ink-600)",
  legs:  "var(--warning)",
  lower: "var(--chart-2)",
  pull:  "var(--success)",
  push:  "var(--primary)",
  upper: "var(--chart-4)",
}

function getRoutineTagLabel(tag: RoutineTag, messages: ReturnType<typeof useLocale>["messages"]) {
  const labels: Record<RoutineTag, string> = {
    full: messages.workoutPage.tagFull,
    legs: messages.workoutPage.tagLegs,
    lower: messages.workoutPage.tagLower,
    pull: messages.workoutPage.tagPull,
    push: messages.workoutPage.tagPush,
    upper: messages.workoutPage.tagUpper,
  }
  return labels[tag]
}

function draftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function inferTag(workout: Workout): RoutineTag {
  const kind = workout.kind
  if (kind === "push" || kind === "pull" || kind === "legs") return kind
  if (kind === "full_body") return "full"
  const name = workout.name.toLowerCase()
  if (name.includes("upper")) return "upper"
  if (name.includes("lower")) return "lower"
  if (name.includes("push"))  return "push"
  if (name.includes("pull"))  return "pull"
  if (name.includes("leg"))   return "legs"
  return "full"
}

function toDraft(exercise: Workout["exercises"][number]): RoutineExerciseDraft {
  const set0 = exercise.sets[0]
  return {
    id: draftId(),
    variationId: exercise.variation.id,
    displayName: exercise.variation.displayName ?? exercise.exercise.name,
    media: exercise.variation.media,
    muscleGroup: exercise.exercise.muscleGroup,
    activityType: exercise.variation.activityType,
    primaryMuscles: exercise.variation.primaryMuscles,
    secondaryMuscles: exercise.variation.secondaryMuscles,
    equipment: exercise.variation.equipment,
    sets: exercise.sets.length,
    reps: formatRepTarget({ reps: set0?.targetReps ?? 10, repsMin: set0?.targetRepsMin }),
    weight: set0?.weight != null ? String(set0.weight) : "",
    rir: set0?.rir != null ? String(set0.rir) : "",
    restTime: exercise.restTime != null ? String(exercise.restTime) : "",
    notes: exercise.notes ?? "",
    setIntensityTags: readSetIntensityAssignments(exercise.sets),
  }
}

// ─── FieldNum ────────────────────────────────────────────────────────────────


/**
 * Turns a routine draft into the workout payload the API expects. Shared with
 * the program editor so a session added to a program is normalized exactly the
 * same way as one saved from this dialog.
 *
 * Throws with a localized message on unparseable reps or an empty routine.
 */
export function buildRoutineWorkoutPayload(
  draft: { exercises: RoutineExerciseDraft[]; name: string; tag: RoutineTag },
  messages: AppMessages,
) {
  const normalizedExercises = draft.exercises
    .filter((ex) => ex.variationId)
    .map((ex, i) => {
      const repTarget = parseRepTargetText(ex.reps)
      if (!repTarget) throw new Error(messages.workoutPage.invalidRepsAtExercise(i + 1))
      const parsedWeight = Number(ex.weight)
      const parsedRir = Number(ex.rir)
      const parsedRest = Number(ex.restTime)
      const sets = Math.max(1, Number(ex.sets) || 1)
      const setIntensityTags = normalizeSetIntensityAssignments(ex.setIntensityTags, sets)
      return {
        notes: ex.notes?.trim() || undefined,
        reps: repTarget.reps,
        repsMin: repTarget.repsMin,
        rir: ex.rir.trim() && Number.isFinite(parsedRir) ? Math.max(0, Math.round(parsedRir)) : undefined,
        restTime: ex.restTime?.trim() && Number.isFinite(parsedRest) ? Math.max(0, Math.round(parsedRest)) : undefined,
        setIntensityTags: setIntensityTags.length ? setIntensityTags : undefined,
        variationId: ex.variationId,
        sets,
        weight: ex.weight.trim() && Number.isFinite(parsedWeight) ? Math.max(0, parsedWeight) : undefined,
      }
    })

  if (normalizedExercises.length === 0) {
    throw new Error(messages.workoutPage.addAtLeastOneExercise)
  }

  return {
    exercises: normalizedExercises,
    kind: draft.tag === "upper" || draft.tag === "lower" || draft.tag === "full" ? "full_body" : draft.tag,
    name: draft.name,
  }
}

// ─── RoutineBuilderDialog ─────────────────────────────────────────────────────

export function RoutineBuilderDialog({
  trigger,
  workoutToEdit,
  onWorkoutSaved,
  open: controlledOpen,
  onOpenChange,
  draftToEdit,
  onSaveDraft,
}: RoutineBuilderDialogProps) {
  const createWorkoutMutation = useCreateWorkout()
  const updateWorkoutMutation = useUpdateWorkout()
  const { isLoading: authLoading, session } = useAuth()
  const { messages } = useLocale()
  const isEditing = Boolean(workoutToEdit) || Boolean(draftToEdit?.id)
  const isControlled = controlledOpen !== undefined

  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen! : internalOpen
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setInternalOpen(v)
  }

  const [name, setName] = useState("")
  const [tag, setTag] = useState<RoutineTag>("push")
  const [exercises, setExercises] = useState<RoutineExerciseDraft[]>([])
  // The builder coordinates card expansion so adding a new exercise can fold
  // the previous one and keep the compact editor from becoming a long scroll.
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<ReadonlySet<string>>(() => new Set())
  // "add" = add new exercise; exerciseId = swap that exercise; null = closed
  const [pickerTarget, setPickerTarget] = useState<string | "add" | null>(null)
  const libraryQuery = useExercises(undefined, undefined, Boolean(pickerTarget))
  const library = libraryQuery.data ?? []
  const loadingLibrary = libraryQuery.isFetching
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSets = exercises.reduce((acc, ex) => acc + (Number(ex.sets) || 0), 0)
  const canSave = name.trim().length > 0 && exercises.length > 0 && !isSaving
  // Recomputed straight from draft state, so the figure tracks every add and
  // remove — that live feedback is the point of showing it in the editor.
  const muscleHighlights = buildMuscleProfileHighlights(
    exercises,
    "var(--primary)",
    "color-mix(in oklab, var(--primary) 45%, var(--body-fill))",
  )

  // ── Reset form on open/close ──────────────────────────────────────────────
  const resetForm = () => {
    let initialExercises: RoutineExerciseDraft[] = []
    if (draftToEdit) {
      setName(draftToEdit.name)
      setTag(draftToEdit.tag)
      initialExercises = draftToEdit.exercises
    } else if (workoutToEdit) {
      setName(workoutToEdit.name)
      setTag(inferTag(workoutToEdit))
      initialExercises = workoutToEdit.exercises.map(toDraft)
    } else {
      setName("")
      setTag("push")
    }
    setExercises(initialExercises)
    setExpandedExerciseIds(new Set())
    setError(null)
  }

  useEffect(() => {
    if (open) resetForm()
  }, [open])



  // ── Exercise handlers ─────────────────────────────────────────────────────
  const addExercises = (options: ExerciseVariationOption[]) => {
    const additions = options
      .filter((option) => !exercises.some((item) => item.variationId === option.id))
      .map((ex) => ({
          id: draftId(),
          variationId: ex.id,
          displayName: ex.displayName ?? ex.name,
          media: ex.media,
          muscleGroup: ex.muscleGroup,
          activityType: ex.activityType,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles,
          equipment: ex.equipment,
          sets: 3,
          reps: "10",
          weight: "",
          rir: "",
          restTime: "",
          notes: "",
          setIntensityTags: [],
        }))
    setExercises((previous) => [...previous, ...additions])
    setExpandedExerciseIds(new Set(additions.map((exercise) => exercise.id)))
    setPickerTarget(null)
  }

  const pickExercise = (ex: ExerciseVariationOption) => {
    if (pickerTarget === "add") {
      addExercises([ex])
    } else if (pickerTarget) {
      // Swap in-place — keep sets/reps/weight/rir, replace identity
      setExercises((prev) =>
        prev.map((item) =>
          item.id === pickerTarget
            ? {
                ...item,
                variationId: ex.id,
                displayName: ex.displayName ?? ex.name,
                media: ex.media,
                muscleGroup: ex.muscleGroup,
                activityType: ex.activityType,
                primaryMuscles: ex.primaryMuscles,
                secondaryMuscles: ex.secondaryMuscles,
                equipment: ex.equipment,
              }
            : item,
        ),
      )
    }
    setPickerTarget(null)
  }

  const updateExercise = (id: string, patch: Partial<RoutineExerciseDraft>) => {
    setExercises((prev) => {
      const isFirst = prev.length > 0 && prev[0].id === id
      if (isFirst && patch.rir !== undefined) {
        return prev.map((ex) => ({ ...ex, rir: patch.rir ?? ex.rir, ...(ex.id === id ? patch : {}) }))
      }
      return prev.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex))
    })
  }

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id))
    setExpandedExerciseIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const moveExercise = (idx: number, dir: -1 | 1) => {
    setExercises((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave) return

    // Draft mode (coach): no DB save — hand data back to caller
    if (onSaveDraft) {
      onSaveDraft({ id: draftToEdit?.id, name: name.trim(), tag, exercises })
      setOpen(false)
      return
    }

    if (!session?.access_token) return
    setIsSaving(true)
    setError(null)

    try {
      const payload = buildRoutineWorkoutPayload({ exercises, name: name.trim(), tag }, messages)

      let saved: Workout
      if (isEditing && workoutToEdit) {
        saved = await updateWorkoutMutation.mutateAsync({ workoutId: workoutToEdit.id, input: payload })
      } else {
        saved = await createWorkoutMutation.mutateAsync(payload)
      }

      onWorkoutSaved?.(saved, workoutToEdit)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.workoutPage.saveRoutineError)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Trigger (uncontrolled mode only) */}
      {trigger != null && (
        <DialogTrigger asChild>
          <span onClick={(e) => { if (authLoading) e.preventDefault(); }} className="contents">
            {trigger}
          </span>
        </DialogTrigger>
      )}

      {/* z-[90] / overlay z-[85]: the coach program editor opens this dialog
          over its own fixed z-[80] modal, which the default z-50 sat beneath. */}
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[85]"
        className="z-[90] flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-full flex-col overflow-hidden p-0 sm:h-[90svh] sm:max-h-[900px] sm:max-w-[640px] sm:rounded-xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{isEditing ? messages.workoutPage.editRoutineMode : messages.workoutPage.newRoutine}</DialogTitle>
          <DialogDescription>{messages.workoutPage.routineNamePlaceholder}</DialogDescription>
        </DialogHeader>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="border-b border-border px-4 pb-[18px] pt-5 sm:px-7 sm:pt-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="label-micro mb-1.5 text-muted-foreground">
                    {isEditing ? messages.workoutPage.editRoutineMode : messages.workoutPage.newRoutine}
                  </p>
                  <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
                    {name.trim() || messages.workoutPage.untitledRoutine}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {messages.workoutPage.exerciseCount(exercises.length)} · {messages.workoutPage.setCount(totalSets)}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-3">
                  <MuscleMapPair
                    size="sm"
                    highlights={muscleHighlights}
                    label={messages.workoutPage.muscleMapLabel}
                    className="mt-0.5"
                  />
                  <DialogClose asChild>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-[18px] w-[18px]" />
                    </button>
                  </DialogClose>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={messages.workoutPage.routineNamePlaceholder}
                  className="flex-1 text-base"
                  autoFocus
                />
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {ROUTINE_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTag(t)}
                      className={cn(
                        "inline-flex h-8 pointer-coarse:h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                        tag === t
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:border-foreground/30",
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: TAG_DOT[t] }}
                      />
                      {getRoutineTagLabel(t, messages)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Exercise list ─────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-7">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">
                  {error}
                </div>
              )}

              {exercises.length === 0 && (
                <div className="mb-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
                  <Dumbbell className="mb-2.5 h-5 w-5 opacity-50" />
                  <p className="text-sm">{messages.workoutPage.noExercisesYet}</p>
                </div>
              )}

              <div className="space-y-3">
                {exercises.map((ex, i) => (
                  <RoutineExerciseCard
                    key={ex.id}
                    defaultExpanded={false}
                    expanded={expandedExerciseIds.has(ex.id)}
                    onExpandedChange={(expanded) =>
                      setExpandedExerciseIds((prev) => {
                        const next = new Set(prev)
                        if (expanded) next.add(ex.id)
                        else next.delete(ex.id)
                        return next
                      })
                    }
                    index={i}
                    total={exercises.length}
                    title={ex.displayName}
                    media={ex.media}
                    meta={[ex.muscleGroup, ex.equipment].filter(Boolean).join(" · ")}
                    values={{
                      notes: ex.notes ?? "",
                      reps: ex.reps,
                      restTime: ex.restTime ?? "",
                      rir: ex.rir,
                      sets: String(ex.sets),
                      weight: ex.weight,
                    }}
                    messages={messages}
                    onFieldChange={(field, value) =>
                      updateExercise(
                        ex.id,
                        field === "sets" ? { sets: Number(value) || 0 } : ({ [field]: value } as Partial<RoutineExerciseDraft>),
                      )
                    }
                    onMove={(direction) => moveExercise(i, direction)}
                    onRemove={() => removeExercise(ex.id)}
                    onSwap={() => setPickerTarget(ex.id)}
                    setIntensityTags={ex.setIntensityTags}
                    onSetIntensityTagsChange={(setIntensityTags) => updateExercise(ex.id, { setIntensityTags })}
                  />
                ))}
              </div>

              {/* Add exercise button */}
              <button
                type="button"
                onClick={() => setPickerTarget("add")}
                className={cn(
                  "mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg",
                  "border border-dashed border-border py-3.5 text-sm font-medium text-primary",
                  "transition-colors hover:bg-muted/50",
                )}
              >
                <span className="text-base leading-none">+</span>
                {messages.workoutPage.addExercise}
              </button>
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="flex flex-col-reverse gap-2.5 border-t border-border bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-7 sm:pb-3">
              <DialogClose asChild>
                <Button variant="ghost" className="w-full sm:w-auto">
                  {messages.common.cancel}
                </Button>
              </DialogClose>
              <Button
                className="w-full sm:w-auto"
                onClick={() => void handleSave()}
                disabled={!canSave}
              >
                {isSaving ? messages.workoutPage.saving : isEditing ? messages.workoutPage.saveChanges : messages.workoutPage.saveRoutine}
              </Button>
            </div>

        {/* Exercise picker sub-modal. It must stay inside DialogContent: Radix
            decides "outside" by the React tree, not the DOM. Rendered as a
            sibling of the content, a touch on a picker row registers as a
            pointerdown outside this dialog, which Radix defers to the next
            click — and once the pick has closed the picker, that click
            dismisses the whole routine dialog. */}
        {pickerTarget && (
          <AddExerciseModal
            exercises={loadingLibrary ? [] : library}
            loading={loadingLibrary}
            currentVariationId={pickerTarget !== "add" ? exercises.find((e) => e.id === pickerTarget)?.variationId : undefined}
            existingVariationIds={
              // When swapping: exclude the exercise being swapped so it shows as pickable
              (pickerTarget === "add"
                ? exercises
                : exercises.filter((e) => e.id !== pickerTarget)
              ).map((e) => e.variationId)
            }
            onPick={pickExercise}
            onPickMany={pickerTarget === "add" ? addExercises : undefined}
            onClose={() => setPickerTarget(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
