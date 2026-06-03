"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { matchesExerciseSearch, sortByExerciseRelevance } from "@/lib/exercise-search"
import type { ExerciseVariationOption } from "@/lib/types"
import { cn } from "@/lib/utils"

type AddExerciseModalProps = {
  /** Full exercise library to browse. */
  exercises: ExerciseVariationOption[]
  /** Variation ids already in the routine — rendered as "added" and non-pickable. */
  existingVariationIds: string[]
  onPick: (option: ExerciseVariationOption) => void
  onClose: () => void
  title?: string
  loading?: boolean
  /** Optional footer slot (e.g. a "Create custom exercise" action). */
  footer?: ReactNode
}

/**
 * Shared "browse library → pick an exercise" modal used by every routine /
 * workout builder (coach program editor, trainee routine board, weekly
 * schedule, in-session add). Renders as a fixed overlay so it works nested
 * inside both the custom routine dialogs and Radix dialogs.
 */
export function AddExerciseModal({
  exercises,
  existingVariationIds,
  onPick,
  onClose,
  title = "Add exercise",
  loading = false,
  footer,
}: AddExerciseModalProps) {
  const [query, setQuery] = useState("")
  const [muscle, setMuscle] = useState("all")
  const inputRef = useRef<HTMLInputElement>(null)
  const existingSet = useMemo(() => new Set(existingVariationIds), [existingVariationIds])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const muscleGroups = useMemo(
    () => [
      "all",
      ...Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup))).sort((left, right) =>
        left.localeCompare(right),
      ),
    ],
    [exercises],
  )

  const visible = useMemo(() => {
    const filtered = exercises.filter((exercise) => {
      if (muscle !== "all" && exercise.muscleGroup !== muscle) return false
      return matchesExerciseSearch(
        [exercise.name, exercise.exerciseName, exercise.variationName, exercise.muscleGroup, exercise.equipment],
        query,
      )
    })
    return sortByExerciseRelevance(filtered, query, (exercise) => exercise.exerciseName)
  }, [exercises, muscle, query])

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-6"
      style={{ background: "rgba(13,13,11,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-[12px] border border-border bg-background"
        style={{ maxHeight: "82vh", boxShadow: "0 24px 60px -12px rgba(13,13,11,0.25)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-[22px] pb-3 pt-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {muscleGroups.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setMuscle(group)}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
                  muscle === group
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:border-foreground/30",
                )}
              >
                {group === "all" ? "All" : group}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading exercises…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No exercises found.
            </div>
          ) : (
            visible.map((exercise, index) => {
              const added = existingSet.has(exercise.id)
              return (
                <button
                  key={exercise.id}
                  type="button"
                  disabled={added}
                  onClick={() => !added && onPick(exercise)}
                  className={cn(
                    "flex w-full items-center gap-3 px-[22px] py-3 text-left transition-colors",
                    index < visible.length - 1 && "border-b border-border",
                    added ? "cursor-default opacity-50" : "hover:bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{exercise.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {exercise.muscleGroup}
                      {exercise.equipment ? ` · ${exercise.equipment}` : ""}
                    </p>
                  </div>
                  {added ? (
                    <span className="text-xs font-medium text-green-600">added</span>
                  ) : (
                    <span className="text-lg leading-none text-muted-foreground">+</span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {footer ? <div className="border-t border-border px-[22px] py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
