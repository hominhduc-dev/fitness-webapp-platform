"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Dumbbell, Trash2, X } from "lucide-react"

import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createWorkout, fetchExercises, updateWorkout } from "@/lib/fitness/api"
import type { ExerciseVariationOption, Workout } from "@/lib/types"
import { cn } from "@/lib/utils"
import { parseRepTargetText, formatRepTarget } from "@/lib/workout-reps"

// ─── Types ──────────────────────────────────────────────────────────────────

type RoutineTag = "push" | "pull" | "legs" | "upper" | "lower" | "full"

export type RoutineExerciseDraft = {
  id: string
  variationId: string
  displayName: string
  muscleGroup: string
  equipment?: string
  sets: number
  reps: string
  weight: string
  rir: string
  restTime?: string
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
  full:  "var(--ink-600, #52525b)",
  legs:  "var(--warning,  #f59e0b)",
  lower: "#1a8a8a",
  pull:  "var(--success,  #22c55e)",
  push:  "var(--primary)",
  upper: "#7c5dff",
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
    displayName: [exercise.exercise.name, exercise.variation.isDefault ? "" : exercise.variation.name]
      .filter(Boolean).join(" — "),
    muscleGroup: exercise.exercise.muscleGroup,
    equipment: exercise.variation.equipment,
    sets: exercise.sets.length,
    reps: formatRepTarget({ reps: set0?.targetReps ?? 10, repsMin: set0?.targetRepsMin }),
    weight: set0?.weight != null ? String(set0.weight) : "",
    rir: set0?.rir != null ? String(set0.rir) : "",
    restTime: exercise.restTime != null ? String(exercise.restTime) : "",
  }
}

// ─── FieldNum ────────────────────────────────────────────────────────────────

function FieldNum({
  label,
  value,
  onChange,
  allowDecimals,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  allowDecimals?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <input
        type={allowDecimals ? "number" : "text"}
        inputMode={allowDecimals ? "decimal" : "numeric"}
        value={value}
        step={allowDecimals ? "0.5" : "1"}
        min="0"
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded border border-border bg-background px-2 py-1.5 text-center font-mono text-sm text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      />
    </div>
  )
}

// ─── RoutineBuilderDialog ─────────────────────────────────────────────────────

export function RoutineBuilderDialog({
  trigger,
  workoutToEdit,
  onWorkoutSaved,
  refreshOnSuccess = true,
  open: controlledOpen,
  onOpenChange,
  draftToEdit,
  onSaveDraft,
}: RoutineBuilderDialogProps) {
  const router = useRouter()
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
  // "add" = add new exercise; exerciseId = swap that exercise; null = closed
  const [pickerTarget, setPickerTarget] = useState<string | "add" | null>(null)
  const [library, setLibrary] = useState<ExerciseVariationOption[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSets = exercises.reduce((acc, ex) => acc + (Number(ex.sets) || 0), 0)
  const canSave = name.trim().length > 0 && exercises.length > 0 && !isSaving

  // ── Reset form on open/close ──────────────────────────────────────────────
  const resetForm = () => {
    if (draftToEdit) {
      setName(draftToEdit.name)
      setTag(draftToEdit.tag)
      setExercises(draftToEdit.exercises)
    } else if (workoutToEdit) {
      setName(workoutToEdit.name)
      setTag(inferTag(workoutToEdit))
      setExercises(workoutToEdit.exercises.map(toDraft))
    } else {
      setName("")
      setTag("push")
      setExercises([])
    }
    setError(null)
  }

  useEffect(() => {
    if (open) resetForm()
  }, [open])

  // ── Load exercise library when picker opens ───────────────────────────────
  useEffect(() => {
    if (!pickerTarget || library.length > 0 || !session?.access_token) return
    setLoadingLibrary(true)
    fetchExercises(session.access_token)
      .then(setLibrary)
      .catch(() => {/* non-critical */})
      .finally(() => setLoadingLibrary(false))
  }, [pickerTarget, session?.access_token])

  // ── Keyboard: Escape to close ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pickerTarget) setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, pickerTarget])

  // ── Exercise handlers ─────────────────────────────────────────────────────
  const pickExercise = (ex: ExerciseVariationOption) => {
    if (pickerTarget === "add") {
      // Add new exercise at the end
      setExercises((prev) => [
        ...prev,
        {
          id: draftId(),
          variationId: ex.id,
          displayName: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment: ex.equipment,
          sets: 3,
          reps: "10",
          weight: "",
          rir: "",
          restTime: "",
        },
      ])
    } else if (pickerTarget) {
      // Swap in-place — keep sets/reps/weight/rir, replace identity
      setExercises((prev) =>
        prev.map((item) =>
          item.id === pickerTarget
            ? {
                ...item,
                variationId: ex.id,
                displayName: ex.name,
                muscleGroup: ex.muscleGroup,
                equipment: ex.equipment,
              }
            : item,
        ),
      )
    }
    setPickerTarget(null)
  }

  const updateExercise = (id: string, patch: Partial<RoutineExerciseDraft>) => {
    setExercises((prev) => prev.map((ex) => ex.id === id ? { ...ex, ...patch } : ex))
  }

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id))
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
      const normalizedExercises = exercises
        .filter((ex) => ex.variationId)
        .map((ex, i) => {
          const repTarget = parseRepTargetText(ex.reps)
          if (!repTarget) throw new Error(messages.workoutPage.invalidRepsAtExercise(i + 1))
          const parsedWeight = Number(ex.weight)
          const parsedRir = Number(ex.rir)
          const parsedRest = Number(ex.restTime)
          return {
            reps: repTarget.reps,
            repsMin: repTarget.repsMin,
            rir: ex.rir.trim() && Number.isFinite(parsedRir) ? Math.max(0, Math.round(parsedRir)) : undefined,
            restTime: ex.restTime?.trim() && Number.isFinite(parsedRest) ? Math.max(0, Math.round(parsedRest)) : undefined,
            variationId: ex.variationId,
            sets: Math.max(1, Number(ex.sets) || 1),
            weight: ex.weight.trim() && Number.isFinite(parsedWeight) ? Math.max(0, parsedWeight) : undefined,
          }
        })

      if (normalizedExercises.length === 0) {
        throw new Error(messages.workoutPage.addAtLeastOneExercise)
      }

      const payload = {
        exercises: normalizedExercises,
        kind: tag === "upper" || tag === "lower" || tag === "full" ? "full_body" : tag,
        name: name.trim(),
      }

      let saved: Workout
      if (isEditing && workoutToEdit) {
        saved = await updateWorkout(session.access_token, workoutToEdit.id, payload)
      } else {
        saved = await createWorkout(session.access_token, payload)
      }

      onWorkoutSaved?.(saved, workoutToEdit)
      setOpen(false)
      if (refreshOnSuccess) router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.workoutPage.saveRoutineError)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger (uncontrolled mode only) */}
      {trigger != null && (
        <span onClick={() => !authLoading && setOpen(true)} className="contents">
          {trigger}
        </span>
      )}

      {/* Backdrop + modal */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-6"
          style={{ background: "rgba(13,13,11,0.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full flex-col overflow-hidden bg-background sm:h-auto sm:max-w-[640px] sm:rounded-[14px]"
            style={{
              maxHeight: "100%",
              boxShadow: "0 24px 60px -12px rgba(13,13,11,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="border-b border-border px-4 pb-[18px] pt-5 sm:px-7 sm:pt-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="label-micro mb-1.5 text-muted-foreground">
                    {isEditing ? messages.workoutPage.editRoutineMode : messages.workoutPage.newRoutine}
                  </p>
                  <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                    {name.trim() || messages.workoutPage.untitledRoutine}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {messages.workoutPage.exerciseCount(exercises.length)} · {messages.workoutPage.setCount(totalSets)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-3 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={messages.workoutPage.routineNamePlaceholder}
                  className="flex-1 text-[15px]"
                  autoFocus
                />
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {ROUTINE_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTag(t)}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
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
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {exercises.length === 0 && (
                <div className="mb-4 flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border py-10 text-center text-muted-foreground">
                  <Dumbbell className="mb-2.5 h-5 w-5 opacity-50" />
                  <p className="text-sm">{messages.workoutPage.noExercisesYet}</p>
                </div>
              )}

              {exercises.map((ex, i) => (
                <div
                  key={ex.id}
                  className="mb-2.5 rounded-[10px] border border-border bg-background p-3.5 sm:px-[18px]"
                >
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="min-w-[18px] text-right font-mono text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      title={messages.workoutPage.swapExercise}
                      onClick={() => setPickerTarget(ex.id)}
                      className="min-w-0 flex-1 rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
                    >
                      <p className="truncate text-sm font-medium text-foreground">{ex.displayName}</p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        {ex.muscleGroup}{ex.equipment ? ` · ${ex.equipment}` : ""}
                        <span className="ml-1.5 text-primary/70">{messages.workoutPage.tapToSwap}</span>
                      </p>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveExercise(i, -1)}
                        disabled={i === 0}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveExercise(i, 1)}
                        disabled={i === exercises.length - 1}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExercise(ex.id)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <FieldNum
                      label={messages.workoutPage.set}
                      value={String(ex.sets)}
                      onChange={(v) => updateExercise(ex.id, { sets: Number(v) || 0 })}
                    />
                    <FieldNum
                      label={messages.workoutPage.reps}
                      value={ex.reps}
                      onChange={(v) => updateExercise(ex.id, { reps: v })}
                      placeholder="8-12"
                    />
                    <FieldNum
                      label="kg"
                      value={ex.weight}
                      onChange={(v) => updateExercise(ex.id, { weight: v })}
                      allowDecimals
                    />
                    <FieldNum
                      label="RIR"
                      value={ex.rir}
                      onChange={(v) => updateExercise(ex.id, { rir: v })}
                      placeholder="0-4"
                    />
                    <FieldNum
                      label="REST"
                      value={ex.restTime ?? ""}
                      onChange={(v) => updateExercise(ex.id, { restTime: v })}
                      placeholder="90"
                    />
                  </div>
                </div>
              ))}

              {/* Add exercise button */}
              <button
                type="button"
                onClick={() => setPickerTarget("add")}
                className={cn(
                  "mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-[10px]",
                  "border border-dashed border-border py-3.5 text-sm font-medium text-primary",
                  "transition-colors hover:bg-muted/50",
                )}
              >
                <span className="text-base leading-none">+</span>
                {messages.workoutPage.addExercise}
              </button>
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="flex justify-end gap-2.5 border-t border-border bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {messages.common.cancel}
              </Button>
              <Button
                className="bg-foreground text-background hover:bg-foreground/90"
                onClick={() => void handleSave()}
                disabled={!canSave}
              >
                {isSaving ? messages.workoutPage.saving : isEditing ? messages.workoutPage.saveChanges : messages.workoutPage.saveRoutine}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise picker sub-modal */}
      {pickerTarget && (
        <AddExerciseModal
          exercises={loadingLibrary ? [] : library}
          loading={loadingLibrary}
          existingVariationIds={
            // When swapping: exclude the exercise being swapped so it shows as pickable
            (pickerTarget === "add"
              ? exercises
              : exercises.filter((e) => e.id !== pickerTarget)
            ).map((e) => e.variationId)
          }
          onPick={pickExercise}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </>
  )
}
