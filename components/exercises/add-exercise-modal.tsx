"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import type { ReactNode } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Input } from "@/components/ui/input"
import { matchesExerciseSearch, sortByExerciseRelevance } from "@/lib/exercise-search"
import type { ExerciseVariationOption } from "@/lib/types"
import { cn } from "@/lib/utils"

type AddExerciseModalProps = {
  /** Full exercise library to browse. */
  exercises: ExerciseVariationOption[]
  /** Variation id of the exercise being swapped — highlighted as "current". */
  currentVariationId?: string
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
  currentVariationId,
  existingVariationIds,
  onPick,
  onClose,
  title,
  loading = false,
  footer,
}: AddExerciseModalProps) {
  const { messages } = useLocale()
  const [query, setQuery] = useState("")
  const [muscle, setMuscle] = useState("all")
  const [equipment, setEquipment] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentRef = useRef<HTMLButtonElement>(null)
  const existingSet = useMemo(() => new Set(existingVariationIds), [existingVariationIds])

  useEffect(() => {
    inputRef.current?.focus()
    requestAnimationFrame(() => {
      currentRef.current?.scrollIntoView({ block: "center" })
    })
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

  const NONE_EQUIPMENT = "__none__"

  const equipmentList = useMemo(() => {
    const set = new Set(exercises.map((exercise) => exercise.equipment))
    const hasNone = set.has(undefined) || set.has("")
    const named = Array.from(set).filter(Boolean).sort() as string[]
    return ["all", ...(hasNone ? [NONE_EQUIPMENT] : []), ...named]
  }, [exercises])

  const visible = useMemo(() => {
    const filtered = exercises.filter((exercise) => {
      if (muscle !== "all" && exercise.muscleGroup !== muscle) return false
      if (equipment !== "all") {
        if (equipment === NONE_EQUIPMENT) { if (exercise.equipment) return false }
        else if (exercise.equipment !== equipment) return false
      }
      return matchesExerciseSearch(
        [exercise.name, exercise.exerciseName, exercise.variationName, exercise.muscleGroup, exercise.equipment],
        query,
      )
    })
    return sortByExerciseRelevance(filtered, query, (exercise) => exercise.exerciseName)
  }, [exercises, muscle, equipment, query])

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
            <h3 className="text-lg font-semibold text-foreground">{title ?? messages.workoutPage.addExercise}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="mb-2.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={messages.workoutPage.searchShortPlaceholder}
                className="pl-9"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                showFilters || muscle !== "all" || equipment !== "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(muscle !== "all" || equipment !== "all") && !showFilters && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>
          {showFilters && (
            <div className="space-y-2 pb-0.5">
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Muscle</p>
                <div className="flex flex-wrap gap-1.5">
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
                      {group === "all" ? messages.workoutPage.all : group}
                    </button>
                  ))}
                </div>
              </div>
              {equipmentList.length > 2 && (
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Equipment</p>
                  <div className="flex flex-wrap gap-1.5">
                    {equipmentList.map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => setEquipment(eq)}
                        className={cn(
                          "inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
                          equipment === eq
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-foreground hover:border-foreground/30",
                        )}
                      >
                        {eq === "all" ? messages.workoutPage.all : eq === NONE_EQUIPMENT ? "Bodyweight" : eq}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {messages.workoutPage.loadingExercises}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {messages.workoutPage.noExercisesFound}
            </div>
          ) : (
            visible.map((exercise, index) => {
              const added = existingSet.has(exercise.id)
              const isCurrent = exercise.id === currentVariationId
              return (
                <button
                  key={exercise.id}
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  disabled={added}
                  onClick={() => !added && onPick(exercise)}
                  className={cn(
                    "flex w-full items-center gap-3 px-[22px] py-3 text-left transition-colors",
                    index < visible.length - 1 && "border-b border-border",
                    isCurrent ? "bg-primary/8 ring-1 ring-inset ring-primary/25" : added ? "cursor-default opacity-50" : "hover:bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", isCurrent ? "text-primary" : "text-foreground")}>{exercise.exerciseName}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {exercise.muscleGroup}
                      {exercise.equipment ? ` · ${exercise.equipment}` : ""}
                      {!exercise.isDefault && exercise.variationName ? ` · ${exercise.variationName}` : ""}
                    </p>
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">current</span>
                  ) : added ? (
                    <span className="text-xs font-medium text-green-600">{messages.workoutPage.added}</span>
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
