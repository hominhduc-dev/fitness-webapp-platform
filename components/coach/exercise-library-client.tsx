"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Dumbbell, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ExerciseLibraryExercise } from "@/lib/fitness/types"

type ExerciseLibraryClientProps = {
  initialExercises: ExerciseLibraryExercise[]
}

export function ExerciseLibraryClient({ initialExercises }: ExerciseLibraryClientProps) {
  const [search, setSearch] = useState("")
  const [muscleGroup, setMuscleGroup] = useState("all")
  const deferredSearch = useDeferredValue(search)

  const muscleGroups = useMemo(
    () => Array.from(new Set(initialExercises.map((exercise) => exercise.muscleGroup))).sort(),
    [initialExercises],
  )

  const filteredExercises = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return initialExercises.filter((exercise) => {
      const matchesGroup = muscleGroup === "all" || exercise.muscleGroup === muscleGroup
      const matchesQuery =
        !query ||
        [
          exercise.name,
          exercise.muscleGroup,
          ...exercise.variations.flatMap((variation) => [variation.name, variation.equipment ?? ""]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)

      return matchesGroup && matchesQuery
    })
  }, [deferredSearch, initialExercises, muscleGroup])

  const equipmentCount = useMemo(
    () =>
      new Set(
        initialExercises.flatMap((exercise) => exercise.variations.map((variation) => variation.equipment).filter(Boolean)),
      ).size,
    [initialExercises],
  )

  const variationCount = useMemo(
    () => initialExercises.reduce((sum, exercise) => sum + exercise.variations.length, 0),
    [initialExercises],
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Exercises</p>
          <p className="mt-2 text-3xl font-bold">{initialExercises.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Variations</p>
          <p className="mt-2 text-3xl font-bold">{variationCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Equipment Types</p>
          <p className="mt-2 text-3xl font-bold">{equipmentCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search exercise, muscle group, equipment..."
              className="pl-10"
            />
          </div>
          <Select value={muscleGroup} onValueChange={setMuscleGroup}>
            <SelectTrigger>
              <SelectValue placeholder="All muscle groups" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All muscle groups</SelectItem>
              {muscleGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredExercises.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No exercise matched the current filter.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredExercises.map((exercise) => (
              <div key={exercise.id} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{exercise.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Dumbbell className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    {exercise.muscleGroup}
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {exercise.variations.length} variation{exercise.variations.length === 1 ? "" : "s"}
                  </span>
                  {exercise.variations
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                    .map((variation) => (
                      <span key={variation.id} className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                        {variation.equipment
                          ? variation.isDefault
                            ? variation.equipment
                            : `${variation.name} · ${variation.equipment}`
                          : variation.name}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
