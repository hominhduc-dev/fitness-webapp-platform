"use client"

import { AlertTriangle, Check, Clock3, Dumbbell, Loader2, Play, RefreshCw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/providers/locale-provider"
import type { AIDailyWorkout } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

function DailyWorkoutPreview({ workout, exerciseNames, mappingRate, onAccept, onRegenerate, isAccepting }: { workout: AIDailyWorkout; exerciseNames: Map<string, string>; mappingRate: number; onAccept: () => void; onRegenerate: () => void; isAccepting: boolean }) {
  const { locale } = useLocale()
  const isVi = locale === "vi"
  return (
    <div className="space-y-5">
      <section className="glass-card rounded-[22px] border border-primary/20 bg-gradient-to-br from-primary-soft via-card to-card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary"><Sparkles className="size-4" />{isVi ? "Buổi tập AI cho hôm nay" : "Today's AI workout"}</div>
        <h2 className="mt-3 text-xl font-semibold sm:text-2xl">{workout.name}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{workout.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Clock3 className="size-3.5" />{workout.duration} {isVi ? "phút" : "min"}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"><Dumbbell className="size-3.5" />{workout.exercises.length} {isVi ? "bài" : "exercises"}</span><span className={cn("rounded-full px-3 py-1.5", mappingRate >= 80 ? "bg-ok-soft text-success" : "bg-warning-soft text-warning")}>{mappingRate}% {isVi ? "khả dụng" : "available"}</span></div>
        {workout.warmup && <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-4"><p className="label-micro mb-1.5">{isVi ? "Khởi động" : "Warm-up"}</p><p className="text-sm leading-relaxed">{workout.warmup}</p></div>}
        {mappingRate < 80 && <div className="mt-4 flex gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning"><AlertTriangle className="size-4 shrink-0" />{isVi ? "Một số bài chưa khớp thư viện. Hãy kiểm tra trước khi lưu." : "Some exercises are not matched to the library. Review them before saving."}</div>}
      </section>

      <section className="space-y-2.5">
        {workout.exercises.map((exercise, index) => {
          const reps = exercise.repsMin ? `${exercise.repsMin}-${exercise.reps}` : exercise.reps
          return <div key={`${exercise.variationId}-${index}`} className="glass-card flex items-center gap-3 rounded-[18px] border bg-card p-3.5 sm:p-4"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-xs font-semibold text-primary">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{exerciseNames.get(exercise.variationId) ?? (isVi ? "Bài tập" : "Exercise")}</p><p className="mt-1 text-xs text-muted-foreground">{exercise.sets} sets × {reps} reps{exercise.rir != null ? ` · RIR ${exercise.rir}` : ""}{exercise.restTime ? ` · ${isVi ? "nghỉ" : "rest"} ${exercise.restTime}s` : ""}</p></div><Check className="size-4 shrink-0 text-success" /></div>
        })}
      </section>

      <div className="glass-surface sticky bottom-3 z-20 grid grid-cols-[0.8fr_1.2fr] gap-2 rounded-[20px] border p-3 shadow-2xl backdrop-blur-xl">
        <Button variant="outline" size="lg" className="gap-2 rounded-xl" onClick={onRegenerate} disabled={isAccepting}><RefreshCw className="size-4" />{isVi ? "Chỉnh lại" : "Adjust"}</Button>
        <Button size="lg" className="gap-2 rounded-xl" onClick={onAccept} disabled={isAccepting}>{isAccepting ? <><Loader2 className="size-4 animate-spin" />{isVi ? "Đang lưu..." : "Saving..."}</> : <><Play className="size-4" />{isVi ? "Lưu & bắt đầu tập" : "Save & start workout"}</>}</Button>
      </div>
    </div>
  )
}

export { DailyWorkoutPreview }
