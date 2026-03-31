"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { formatExerciseVariationLabel, formatExerciseVariationMeta } from "@/lib/exercise-display"
import type { ExerciseVariationOption } from "@/lib/types"
import { cn } from "@/lib/utils"

type ExercisePickerProps = {
  disabled?: boolean
  exercises: ExerciseVariationOption[]
  fallbackSelection?: {
    equipment?: string
    exerciseName?: string
    isDefault?: boolean
    muscleGroup?: string
    variationName?: string
  }
  onSelect: (variationId: string) => void
  selectedVariationId: string
}

export function ExercisePicker({
  disabled,
  exercises,
  fallbackSelection,
  onSelect,
  selectedVariationId,
}: ExercisePickerProps) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [query, setQuery] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === selectedVariationId) ?? null,
    [exercises, selectedVariationId],
  )

  const groupedExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const grouped = new Map<string, ExerciseVariationOption[]>()

    for (const exercise of exercises.slice().sort((left, right) => {
      const exerciseNameComparison = left.exerciseName.localeCompare(right.exerciseName)

      if (exerciseNameComparison !== 0) {
        return exerciseNameComparison
      }

      const sortOrderComparison = left.sortOrder - right.sortOrder

      if (sortOrderComparison !== 0) {
        return sortOrderComparison
      }

      return left.variationName.localeCompare(right.variationName)
    })) {
      const searchable = [
        exercise.exerciseName,
        exercise.variationName,
        exercise.name,
        exercise.muscleGroup,
        exercise.equipment ?? "",
      ]
        .join(" ")
        .toLowerCase()

      if (normalizedQuery && !searchable.includes(normalizedQuery)) {
        continue
      }

      const groupItems = grouped.get(exercise.muscleGroup) ?? []
      groupItems.push(exercise)
      grouped.set(exercise.muscleGroup, groupItems)
    }

    return Array.from(grouped.entries())
      .sort(([leftGroup], [rightGroup]) => leftGroup.localeCompare(rightGroup))
      .map(([muscleGroup, items]) => ({
        items,
        muscleGroup,
      }))
  }, [exercises, query])

  const isSearching = query.trim().length > 0

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const syncViewport = () => {
      setIsMobile(mediaQuery.matches)
    }

    syncViewport()
    mediaQuery.addEventListener("change", syncViewport)

    return () => {
      mediaQuery.removeEventListener("change", syncViewport)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
      return
    }

    setExpandedGroups(selectedExercise ? new Set([selectedExercise.muscleGroup]) : new Set())

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    if (isMobile) {
      return () => {
        window.cancelAnimationFrame(frame)
      }
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return
      }

      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isMobile, open, selectedExercise])

  const toggleGroup = (groupName: string) => {
    if (isSearching) {
      return
    }

    setExpandedGroups((current) => {
      const next = new Set(current)

      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }

      return next
    })
  }

  const handleSelectExercise = (exercise: ExerciseVariationOption) => {
    onSelect(exercise.id)
    setExpandedGroups(new Set([exercise.muscleGroup]))
    setQuery("")
    setOpen(false)
  }

  const pickerListClassName = cn(
    "mt-3 space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(148,163,184,0.45)_transparent] [scrollbar-width:thin] [touch-action:pan-y] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent",
    isMobile ? "min-h-0 flex-1 max-h-none overscroll-contain" : "max-h-[18rem] md:max-h-[20rem]",
  )

  const pickerPanel = (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercise, variation, or muscle group"
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-[3px]"
        />
      </div>

      <div className={pickerListClassName}>
        {groupedExercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-center text-sm text-muted-foreground">
            No exercises match this search.
          </div>
        ) : (
          groupedExercises.map((group) => {
            const isExpanded = isSearching || expandedGroups.has(group.muscleGroup)

            return (
              <div key={group.muscleGroup} className="rounded-2xl border border-border/70 bg-muted/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => toggleGroup(group.muscleGroup)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{group.muscleGroup}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.items.length} exercise{group.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {group.items.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {isExpanded ? (
                  <div className="space-y-1 border-t border-border/60 px-2 py-2">
                    {group.items.map((exercise) => {
                      const isSelected = exercise.id === selectedVariationId

                      return (
                        <button
                          key={exercise.id}
                          type="button"
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent/60",
                          )}
                          onClick={() => handleSelectExercise(exercise)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                            )}
                          >
                            {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{exercise.exerciseName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {formatExerciseVariationMeta({
                                equipment: exercise.equipment,
                                isDefault: exercise.isDefault,
                                muscleGroup: exercise.muscleGroup,
                                variationName: exercise.variationName,
                              })}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </>
  )

  return (
    <div ref={containerRef} className="relative z-20 min-w-0">
      <button
        type="button"
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/90 px-4 py-2 text-left shadow-none transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/25",
          open && "border-primary/35 ring-2 ring-primary/10",
        )}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current)
          }
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm sm:text-base",
              selectedExercise || fallbackSelection ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selectedExercise
              ? formatExerciseVariationLabel({
                  exerciseName: selectedExercise.exerciseName,
                  isDefault: selectedExercise.isDefault,
                  variationName: selectedExercise.variationName,
                })
              : fallbackSelection
                ? formatExerciseVariationLabel({
                    exerciseName: fallbackSelection.exerciseName,
                    isDefault: fallbackSelection.isDefault,
                    variationName: fallbackSelection.variationName,
                  })
              : "Choose an exercise"}
          </span>
          {selectedExercise || fallbackSelection ? (
            <span className="block truncate text-xs text-muted-foreground">
              {selectedExercise
                ? formatExerciseVariationMeta({
                    equipment: selectedExercise.equipment,
                    isDefault: selectedExercise.isDefault,
                    muscleGroup: selectedExercise.muscleGroup,
                    variationName: selectedExercise.variationName,
                  })
                : formatExerciseVariationMeta({
                    equipment: fallbackSelection?.equipment,
                    isDefault: fallbackSelection?.isDefault,
                    muscleGroup: fallbackSelection?.muscleGroup,
                    variationName: fallbackSelection?.variationName,
                  })}
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
              <DrawerContent className="max-h-[82svh] overflow-hidden rounded-t-[28px] border-t border-border bg-background/98">
            <DrawerHeader className="px-4 pt-4 text-left">
              <DrawerTitle>Choose an exercise</DrawerTitle>
              <DrawerDescription>Search by exercise name, variation, or muscle group.</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-5">
              {pickerPanel}
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}

      {open && !isMobile ? (
        <div className="absolute inset-x-0 bottom-full mb-3 rounded-[22px] border border-border/70 bg-background/95 p-3 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.32)] backdrop-blur-sm">
          {pickerPanel}
        </div>
      ) : null}
    </div>
  )
}
