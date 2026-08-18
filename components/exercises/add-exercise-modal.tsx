"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import type { ReactNode } from "react"

import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import type { MuscleSlug as MapMuscleSlug } from "@/components/body/muscle-map"
import { useLocale } from "@/components/providers/locale-provider"
import { Input } from "@/components/ui/input"
import { matchesExerciseSearch, sortByExerciseRelevance } from "@/lib/exercise-search"
import { EXERCISE_ACTIVITY_TYPES, MUSCLE_SLUGS } from "@/lib/fitness/muscle-profile"
import { muscleGroupFromSlug, muscleGroupToSlugs } from "@/lib/fitness/muscle-map"
import type { ExerciseActivityType, ExerciseVariationOption, MuscleSlug } from "@/lib/types"
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
  const { locale, messages } = useLocale()
  const [query, setQuery] = useState("")
  const [muscle, setMuscle] = useState<"all" | MuscleSlug>("all")
  const [equipment, setEquipment] = useState("all")
  const [activityType, setActivityType] = useState<"all" | ExerciseActivityType>("all")
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentRef = useRef<HTMLButtonElement>(null)
  const existingSet = useMemo(() => new Set(existingVariationIds), [existingVariationIds])
  const filterCopy = locale === "vi"
    ? {
        activity: "Hoạt động",
        allMuscles: "Tất cả nhóm cơ",
        done: "Áp dụng",
        equipment: "Thiết bị",
        filter: "Lọc bài tập",
        hint: "Chạm trực tiếp vào vùng cơ trên hình để lọc bài tập.",
        muscle: "Nhóm cơ",
        reset: "Đặt lại",
      }
    : {
        activity: "Activity",
        allMuscles: "All muscles",
        done: "Apply",
        equipment: "Equipment",
        filter: "Filter exercises",
        hint: "Tap a muscle region on the map to filter exercises.",
        muscle: "Muscle",
        reset: "Reset",
      }

  useEffect(() => {
    inputRef.current?.focus()
    requestAnimationFrame(() => {
      currentRef.current?.scrollIntoView({ block: "center" })
    })
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (showFilters) {
        setShowFilters(false)
        return
      }
      onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, showFilters])

  const NONE_EQUIPMENT = "__none__"

  const equipmentList = useMemo(() => {
    const set = new Set(exercises.map((exercise) => exercise.equipment))
    const hasNone = set.has(undefined) || set.has("")
    const named = Array.from(set).filter(Boolean).sort() as string[]
    return ["all", ...(hasNone ? [NONE_EQUIPMENT] : []), ...named]
  }, [exercises])

  const visible = useMemo(() => {
    const filtered = exercises.filter((exercise) => {
      if (muscle !== "all") {
        const explicitMuscles = [...exercise.primaryMuscles, ...exercise.secondaryMuscles]
        const targetMuscles = explicitMuscles.length > 0
          ? explicitMuscles
          : muscleGroupToSlugs(exercise.muscleGroup)
        if (!targetMuscles.includes(muscle)) return false
      }
      if (activityType !== "all" && exercise.activityType !== activityType) return false
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
  }, [activityType, exercises, muscle, equipment, query])

  function toggleMuscle(slug: MapMuscleSlug) {
    if (!(MUSCLE_SLUGS as readonly string[]).includes(slug)) return
    setMuscle((current) => current === slug ? "all" : slug as MuscleSlug)
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-overlay p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[12px] border border-border bg-background shadow-[var(--glass-shadow)]"
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
              aria-label={filterCopy.filter}
              onClick={() => setShowFilters(true)}
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                showFilters || muscle !== "all" || equipment !== "all" || activityType !== "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(muscle !== "all" || equipment !== "all" || activityType !== "all") && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>
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
                    <span className="text-xs font-medium text-success-text">{messages.workoutPage.added}</span>
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

      {showFilters ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-overlay p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(event) => {
            event.stopPropagation()
            setShowFilters(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-filter-title"
            className="flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-border bg-background shadow-2xl sm:rounded-[16px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h4 id="exercise-filter-title" className="text-lg font-semibold text-foreground">{filterCopy.filter}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{filterCopy.hint}</p>
              </div>
              <button
                type="button"
                aria-label={messages.workoutPage.cancel}
                onClick={() => setShowFilters(false)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {filterCopy.muscle}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMuscle("all")}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
                    disabled={muscle === "all"}
                  >
                    {filterCopy.reset}
                  </button>
                </div>
                <div className="rounded-[14px] border border-border bg-card px-4 py-4">
                  <MuscleMapPair
                    size="md"
                    label={filterCopy.hint}
                    highlights={muscle === "all" ? {} : { [muscle]: "var(--primary)" }}
                    onMuscleClick={toggleMuscle}
                    className="mx-auto"
                  />
                </div>
                <p className="mt-2 text-center text-sm font-medium text-foreground">
                  {muscle === "all"
                    ? filterCopy.allMuscles
                    : `${muscleGroupFromSlug(muscle) ?? filterCopy.muscle} · ${muscle.replaceAll("-", " ")}`}
                </p>
              </section>

              <section>
                <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {filterCopy.activity}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", ...EXERCISE_ACTIVITY_TYPES] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActivityType(type)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
                        activityType === type
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:border-foreground/30",
                      )}
                    >
                      {type === "all" ? messages.workoutPage.all : type}
                    </button>
                  ))}
                </div>
              </section>

              {equipmentList.length > 2 ? (
                <section>
                  <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {filterCopy.equipment}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {equipmentList.map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => setEquipment(eq)}
                        className={cn(
                          "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
                          equipment === eq
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-foreground hover:border-foreground/30",
                        )}
                      >
                        {eq === "all" ? messages.workoutPage.all : eq === NONE_EQUIPMENT ? "Bodyweight" : eq}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setMuscle("all")
                  setActivityType("all")
                  setEquipment("all")
                }}
                className="h-10 rounded-[8px] border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                {filterCopy.reset}
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="h-10 rounded-[8px] bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {filterCopy.done}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
