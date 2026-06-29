"use client"

import { Check, Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PreviewExercise = {
  variationId: string
  sets: number
  reps: number
  repsMin?: number
  rir?: number
  restTime?: number
  weight?: number
}

type PreviewWorkout = {
  name: string
  kind: string
  weekIndex: number
  scheduledDay: number
  duration: number
  exercises: PreviewExercise[]
}

type PreviewProgram = {
  name: string
  description: string
  difficulty: string
  duration: number
  workoutsPerWeek: number
  workouts: PreviewWorkout[]
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Mới bắt đầu",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
}

const KIND_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  full_body: "Full Body",
  cardio: "Cardio",
  other: "Khác",
}

function ProgramPreview({
  program,
  exerciseNames,
  mappingRate,
  onAccept,
  onRegenerate,
  isAccepting,
}: {
  program: PreviewProgram
  exerciseNames: Map<string, string>
  mappingRate: number
  onAccept: () => void
  onRegenerate: () => void
  isAccepting: boolean
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{program.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            {DIFFICULTY_LABELS[program.difficulty] ?? program.difficulty}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            {program.duration} tuần
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            {program.workoutsPerWeek} buổi/tuần
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            {mappingRate}% bài tập khớp
          </span>
        </div>
      </div>

      {/* Workouts */}
      <div className="space-y-3">
        {program.workouts.map((workout, i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <span className="text-sm font-semibold">{workout.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {DAY_LABELS[workout.scheduledDay]} · {workout.duration} phút
                </span>
              </div>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                "bg-muted text-muted-foreground",
              )}>
                {KIND_LABELS[workout.kind] ?? workout.kind}
              </span>
            </div>
            <div className="divide-y">
              {workout.exercises.map((exercise, j) => {
                const name = exerciseNames.get(exercise.variationId) ?? "Bài tập"
                const repsLabel = exercise.repsMin
                  ? `${exercise.repsMin}-${exercise.reps}`
                  : `${exercise.reps}`
                return (
                  <div key={j} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{exercise.sets} sets × {repsLabel} reps</span>
                      {exercise.weight ? <span>{exercise.weight}kg</span> : null}
                      {exercise.rir != null ? <span>RIR {exercise.rir}</span> : null}
                    </div>
                  </div>
                )
              })}
              {workout.exercises.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Không có bài tập (lỗi mapping)
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={onRegenerate}
          disabled={isAccepting}
        >
          <RefreshCw className="size-4" />
          Tạo lại
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={onAccept}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Check className="size-4" />
              Chấp nhận chương trình
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export { ProgramPreview }
