"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import { cn } from "@/lib/utils"
import type { WorkoutExercise, ExerciseSet } from "@/lib/types"

const setTableGridClass =
  "grid grid-cols-[2.5rem_minmax(3.75rem,0.95fr)_repeat(4,minmax(0,1fr))] gap-2 sm:grid-cols-12"

interface ExerciseCardProps {
  exercise: WorkoutExercise
  exerciseIndex: number
  weightUnit?: "kg" | "lbs"
  onSetComplete?: (setId: string, data: Partial<ExerciseSet>) => void
  isActive?: boolean
}

export function ExerciseCard({
  exercise,
  exerciseIndex,
  weightUnit = "kg",
  onSetComplete,
  isActive = false,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [draftWeightsBySetId, setDraftWeightsBySetId] = useState<Record<string, string>>({})
  const completedSets = exercise.sets.filter((s) => s.completed).length
  const weightUnitLabel = weightUnit === "lbs" ? "lbs" : "kg"
  const firstSetWeight = exercise.sets[0] ? draftWeightsBySetId[exercise.sets[0].id]?.trim() || exercise.sets[0].weight?.toString() : undefined

  useEffect(() => {
    setDraftWeightsBySetId(
      Object.fromEntries(exercise.sets.map((set) => [set.id, set.weight?.toString() ?? ""])),
    )
  }, [exercise.id, exercise.sets])

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all overflow-hidden",
        isActive ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border",
      )}
    >
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold",
              isActive ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {exerciseIndex + 1}
          </div>
            <div className="text-left">
              <p className="font-semibold">
                {formatExerciseVariationLabel({
                  exerciseName: exercise.exercise.name,
                  isDefault: exercise.variation.isDefault,
                  variationName: exercise.variation.name,
                })}
              </p>
            <p className="text-sm text-muted-foreground">
              {completedSets}/{exercise.sets.length} sets · {exercise.exercise.muscleGroup}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completedSets === exercise.sets.length && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20">
              <Check className="h-4 w-4 text-success" />
            </div>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Sets table */}
      {expanded && (
        <div className="border-t border-border">
          {/* Table header */}
          <div
            className={cn(
              setTableGridClass,
              "bg-muted/30 px-4 py-2 text-[11px] font-medium text-muted-foreground sm:text-xs",
            )}
          >
            <div className="sm:col-span-1">SET</div>
            <div className="min-w-0 sm:col-span-3">PREV</div>
            <div className="text-center leading-tight sm:col-span-3">WEIGHT ({weightUnitLabel.toUpperCase()})</div>
            <div className="text-center sm:col-span-2">REPS</div>
            <div className="text-center sm:col-span-2">RIR</div>
            <div className="flex items-center justify-center sm:col-span-1">
              <Check className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Sets */}
          {exercise.sets.map((set, setIdx) => (
            <SetRow
              key={set.id}
              placeholderWeight={setIdx > 0 ? firstSetWeight || weightUnitLabel : weightUnitLabel}
              set={set}
              setIndex={setIdx}
              weightUnitLabel={weightUnitLabel}
              onWeightChange={(value) =>
                setDraftWeightsBySetId((currentDrafts) => ({
                  ...currentDrafts,
                  [set.id]: value,
                }))
              }
              onComplete={(data) => onSetComplete?.(set.id, data)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SetRowProps {
  placeholderWeight: string
  set: ExerciseSet
  setIndex: number
  weightUnitLabel: string
  onWeightChange?: (value: string) => void
  onComplete?: (data: Partial<ExerciseSet>) => void
}

function formatPreviousPerformance(set: ExerciseSet, weightUnitLabel: string) {
  const previousPerformance = set.previousPerformance

  if (!previousPerformance) {
    return "—"
  }

  const repsLabel = previousPerformance.reps != null ? previousPerformance.reps.toString() : undefined
  const weightLabel =
    previousPerformance.weight != null ? `${previousPerformance.weight} ${weightUnitLabel}` : undefined

  if (weightLabel && repsLabel) {
    return `${weightLabel} × ${repsLabel}`
  }

  if (weightLabel) {
    return weightLabel
  }

  if (repsLabel) {
    return `— × ${repsLabel}`
  }

  return "—"
}

function SetRow({ set, setIndex, weightUnitLabel, placeholderWeight, onWeightChange, onComplete }: SetRowProps) {
  const [weight, setWeight] = useState(set.weight?.toString() || "")
  const [reps, setReps] = useState(set.actualReps?.toString() || set.targetReps.toString())
  const [rir, setRir] = useState(set.rir?.toString() || "2")
  const [completed, setCompleted] = useState(set.completed)

  useEffect(() => {
    setWeight(set.weight?.toString() || "")
  }, [set.id, set.weight])

  const handleComplete = () => {
    const newCompleted = !completed
    setCompleted(newCompleted)
    onComplete?.({
      completed: newCompleted,
      weight: Number.parseFloat(weight) || undefined,
      actualReps: Number.parseInt(reps) || set.targetReps,
      rir: Number.parseInt(rir) || undefined,
    })
  }

  return (
    <div
      className={cn(
        setTableGridClass,
        "items-center border-b border-border px-4 py-3 last:border-0",
        completed && "bg-success/5",
      )}
    >
      <div className="sm:col-span-1">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
            completed ? "bg-success text-success-foreground" : "bg-muted",
          )}
        >
          {completed ? <Check className="h-4 w-4" /> : setIndex + 1}
        </span>
      </div>

      <div className="min-w-0 text-xs text-muted-foreground sm:col-span-3 sm:text-sm">
        {formatPreviousPerformance(set, weightUnitLabel)}
      </div>

      <div className="min-w-0 sm:col-span-3">
        <Input
          type="number"
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value)
            onWeightChange?.(e.target.value)
          }}
          placeholder={placeholderWeight}
          className="h-9 w-full min-w-0 text-center bg-background"
        />
      </div>

      <div className="min-w-0 sm:col-span-2">
        <Input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="h-9 w-full min-w-0 text-center bg-background"
        />
      </div>

      <div className="min-w-0 sm:col-span-2">
        <Input
          type="number"
          value={rir}
          onChange={(e) => setRir(e.target.value)}
          placeholder="RIR"
          className="h-9 w-full min-w-0 text-center bg-background"
        />
      </div>

      <div className="min-w-0 sm:col-span-1">
        <Button
          variant={completed ? "default" : "outline"}
          className={cn(
            "h-9 w-full min-w-0 px-0",
            completed && "bg-success hover:bg-success/90",
          )}
          onClick={handleComplete}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
