"use client"

import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles } from "lucide-react"

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
      <div className="glass-card rounded-[22px] border border-primary/20 bg-gradient-to-br from-primary-soft/80 via-card to-card p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary"><Sparkles className="size-4" />Chương trình AI đề xuất</div>
        <h2 className="text-xl font-semibold">{program.name}</h2>
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
          <span className={cn("rounded-full px-2.5 py-1", mappingRate >= 80 ? "bg-ok-soft text-success" : "bg-warning-soft text-warning")}>
            {mappingRate}% bài tập khả dụng
          </span>
        </div>
        {mappingRate < 80 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning-soft p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Một số bài AI đề xuất chưa có trong thư viện. Hãy kiểm tra kỹ trước khi lưu hoặc tạo lại cấu hình.
          </div>
        )}
      </div>

      {/* Workouts */}
      <div className="space-y-3">
        {program.workouts.map((workout, i) => (
          <div key={i} className="glass-card overflow-hidden rounded-[20px] border bg-card">
            <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3.5">
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
                  <div key={j} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="min-w-0 font-medium sm:truncate">{name}</span>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
      <div className="glass-surface sticky bottom-3 z-20 flex gap-2 rounded-[20px] border p-3 shadow-2xl backdrop-blur-xl sm:gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-2 rounded-xl"
          onClick={onRegenerate}
          disabled={isAccepting}
        >
          <RefreshCw className="size-4" />
          Chỉnh cấu hình
        </Button>
        <Button
          className="flex-1 gap-2 rounded-xl"
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
              Lưu chương trình
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export { ProgramPreview }
