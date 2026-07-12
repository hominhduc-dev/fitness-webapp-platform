"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { WorkoutExercise, ExerciseSet } from "@/lib/types"

interface ExerciseCardProps {
  exercise: WorkoutExercise
  exerciseIndex: number
  onSetComplete?: (setId: string, data: Partial<ExerciseSet>) => void
  isActive?: boolean
}

export function ExerciseCard({ exercise, exerciseIndex, onSetComplete, isActive = false }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(isActive)
  const completedSets = exercise.sets.filter((s) => s.completed).length

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
            <p className="font-semibold">{exercise.exercise.name}</p>
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
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
            <div className="col-span-1">SET</div>
            <div className="col-span-3">PREV</div>
            <div className="col-span-3 text-center">WEIGHT</div>
            <div className="col-span-2 text-center">REPS</div>
            <div className="col-span-2 text-center">RIR</div>
            <div className="col-span-1"></div>
          </div>

          {/* Sets */}
          {exercise.sets.map((set, setIdx) => (
            <SetRow key={set.id} set={set} setIndex={setIdx} onComplete={(data) => onSetComplete?.(set.id, data)} />
          ))}

          {/* Add set button */}
          <div className="p-3 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Set
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SetRowProps {
  set: ExerciseSet
  setIndex: number
  onComplete?: (data: Partial<ExerciseSet>) => void
}

function SetRow({ set, setIndex, onComplete }: SetRowProps) {
  const [weight, setWeight] = useState(set.weight?.toString() || "")
  const [reps, setReps] = useState(set.actualReps?.toString() || set.targetReps.toString())
  const [rir, setRir] = useState(set.rir?.toString() || "2")
  const [completed, setCompleted] = useState(set.completed)

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
        "grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-border last:border-0",
        completed && "bg-success/5",
      )}
    >
      <div className="col-span-1">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
            completed ? "bg-success text-success-foreground" : "bg-muted",
          )}
        >
          {completed ? <Check className="h-4 w-4" /> : setIndex + 1}
        </span>
      </div>

      <div className="col-span-3 text-sm text-muted-foreground">
        {set.weight ? `${set.weight} × ${set.targetReps}` : `— × ${set.targetReps}`}
      </div>

      <div className="col-span-3">
        <Input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="lbs"
          className="h-9 text-center bg-background"
        />
      </div>

      <div className="col-span-2">
        <Input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="h-9 text-center bg-background"
        />
      </div>

      <div className="col-span-2">
        <Input
          type="number"
          value={rir}
          onChange={(e) => setRir(e.target.value)}
          placeholder="RIR"
          className="h-9 text-center bg-background"
        />
      </div>

      <div className="col-span-1 flex justify-end">
        <Button
          variant={completed ? "default" : "outline"}
          size="icon"
          className={cn("h-9 w-9", completed && "bg-success hover:bg-success/90")}
          onClick={handleComplete}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
