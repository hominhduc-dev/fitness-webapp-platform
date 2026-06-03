"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { WorkoutLog } from "@/lib/types"

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatVolume(value?: number) {
  if (!value) return "0"
  return new Intl.NumberFormat("en-US").format(Math.round(value))
}

function countSets(log: WorkoutLog) {
  return log.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
}

/**
 * Compact, in-place preview of fetched workout logs — shown inside the export
 * dialogs so users can eyeball the data before downloading. Each session row
 * expands to its exercises and per-set weight × reps.
 */
export function WorkoutLogsPreview({ logs }: { logs: WorkoutLog[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const totalSets = logs.reduce((total, log) => total + countSets(log), 0)
  const totalVolume = logs.reduce((total, log) => total + (log.totalVolume ?? 0), 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {logs.length} buổi · {totalSets} sets
        </span>
        <span>{formatVolume(totalVolume)} kg tổng</span>
      </div>

      <div className="max-h-64 divide-y divide-border overflow-y-auto overscroll-contain rounded-md border border-border">
        {logs.map((log) => {
          const isOpen = expanded.has(log.id)
          return (
            <div key={log.id}>
              <button
                type="button"
                onClick={() => toggle(log.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{log.workout?.name ?? "Workout"}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    {formatDate(log.startedAt)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] tnum text-muted-foreground">
                  {countSets(log)} sets · {formatVolume(log.totalVolume)} kg
                </span>
              </button>

              {isOpen ? (
                <div className="bg-muted/30 px-3 pb-2.5 pt-0.5">
                  {log.exercises.length === 0 ? (
                    <p className="py-1 text-xs text-muted-foreground">Không có bài tập.</p>
                  ) : (
                    log.exercises.map((exercise) => (
                      <div key={exercise.id} className="border-l border-border py-1 pl-3">
                        <p className="text-xs font-medium text-foreground">
                          {exercise.exercise?.name}
                          {exercise.variation && !exercise.variation.isDefault ? (
                            <span className="text-muted-foreground"> · {exercise.variation.name}</span>
                          ) : null}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {exercise.sets.map((set) => (
                            <span
                              key={set.id}
                              className={cn(
                                "rounded border px-1.5 py-0.5 font-mono text-[10px] tnum",
                                set.completed
                                  ? "border-[var(--success)]/40 text-[var(--success)]"
                                  : "border-border text-muted-foreground",
                              )}
                            >
                              {set.weight != null ? `${set.weight}kg` : "—"} × {set.actualReps ?? set.targetReps}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
