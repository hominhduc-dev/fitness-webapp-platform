"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Dumbbell, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  createCoachExerciseRequest,
  deleteCoachExerciseRequest,
  updateCoachExerciseRequest,
} from "@/lib/fitness/api"
import type { CoachExercise } from "@/lib/fitness/types"

type ExerciseLibraryClientProps = {
  initialExercises: CoachExercise[]
}

type ExerciseFormState = {
  equipment: string
  muscleGroup: string
  name: string
}

function createDefaultForm(): ExerciseFormState {
  return {
    equipment: "",
    muscleGroup: "",
    name: "",
  }
}

function sortExercises(exercises: CoachExercise[]) {
  return exercises
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name) || left.muscleGroup.localeCompare(right.muscleGroup))
}

export function ExerciseLibraryClient({ initialExercises }: ExerciseLibraryClientProps) {
  const { session } = useAuth()
  const [exercises, setExercises] = useState(sortExercises(initialExercises))
  const [search, setSearch] = useState("")
  const [form, setForm] = useState<ExerciseFormState>(createDefaultForm)
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const filteredExercises = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    if (!query) {
      return exercises
    }

    return exercises.filter((exercise) =>
      [exercise.name, exercise.muscleGroup, exercise.equipment ?? "", exercise.createdByName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
  }, [deferredSearch, exercises])

  const sharedExercises = filteredExercises.filter((exercise) => exercise.source === "system")
  const myExercises = filteredExercises.filter((exercise) => exercise.source === "coach")
  const muscleGroups = Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup))).sort()

  const startEditing = (exercise: CoachExercise) => {
    setEditingExerciseId(exercise.id)
    setForm({
      equipment: exercise.equipment ?? "",
      muscleGroup: exercise.muscleGroup,
      name: exercise.name,
    })
    setError(null)
    setNotice(null)
  }

  const resetForm = () => {
    setEditingExerciseId(null)
    setForm(createDefaultForm())
  }

  const handleSaveExercise = async () => {
    if (!session?.access_token || isSaving) {
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const payload = {
        equipment: form.equipment.trim() || undefined,
        muscleGroup: form.muscleGroup.trim(),
        name: form.name.trim(),
      }

      const savedExercise = editingExerciseId
        ? await updateCoachExerciseRequest(session.access_token, editingExerciseId, payload)
        : await createCoachExerciseRequest(session.access_token, payload)

      setExercises((current) => {
        const nextExercises = editingExerciseId
          ? current.map((exercise) => (exercise.id === savedExercise.id ? savedExercise : exercise))
          : [savedExercise, ...current]

        return sortExercises(nextExercises)
      })
      setNotice(editingExerciseId ? "Updated your personal exercise." : "Added a new personal exercise.")
      resetForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu bài tập cá nhân.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!session?.access_token || deletingExerciseId) {
      return
    }

    setDeletingExerciseId(exerciseId)
    setError(null)
    setNotice(null)

    try {
      await deleteCoachExerciseRequest(session.access_token, exerciseId)
      setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
      if (editingExerciseId === exerciseId) {
        resetForm()
      }
      setNotice("Deleted the personal exercise.")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa bài tập này.")
    } finally {
      setDeletingExerciseId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">All exercises</p>
          <p className="mt-2 text-3xl font-bold">{exercises.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Shared library</p>
          <p className="mt-2 text-3xl font-bold">{exercises.filter((exercise) => exercise.source === "system").length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">My library</p>
          <p className="mt-2 text-3xl font-bold">{exercises.filter((exercise) => exercise.source === "coach").length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-muted/15 p-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">
                {editingExerciseId ? "Edit personal exercise" : "Create personal exercise"}
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Them bai tap rieng cho coach, co the dung ngay trong program editor.
            </p>

            {error ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                {notice}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="exercise-name">Exercise name</Label>
                <Input
                  id="exercise-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Tempo Hack Squat"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="exercise-muscle-group">Muscle group</Label>
                <Input
                  id="exercise-muscle-group"
                  value={form.muscleGroup}
                  onChange={(event) => setForm((current) => ({ ...current, muscleGroup: event.target.value }))}
                  placeholder="e.g. Legs"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="exercise-equipment">Equipment</Label>
                <Input
                  id="exercise-equipment"
                  value={form.equipment}
                  onChange={(event) => setForm((current) => ({ ...current, equipment: event.target.value }))}
                  placeholder="e.g. Barbell"
                  className="mt-1.5"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => void handleSaveExercise()}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingExerciseId ? "Save changes" : "Add to my library"}
                </Button>
                {editingExerciseId ? (
                  <Button type="button" variant="outline" className="bg-transparent" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, muscle group, equipment..."
                  className="pl-10"
                />
              </div>
              <Select
                value="all"
                onValueChange={(value) => {
                  if (value === "all") {
                    setSearch("")
                  } else {
                    setSearch(value)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Quick filter muscle group" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="all">All muscle groups</SelectItem>
                  {muscleGroups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">My Library</h2>
                  <p className="text-sm text-muted-foreground">Coach-owned exercises that you can edit or delete.</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {myExercises.length} items
                </span>
              </div>

              {myExercises.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Chua co bai tap ca nhan nao. Tao bai tap dau tien o cot ben trai.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {myExercises.map((exercise) => (
                    <div key={exercise.id} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{exercise.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {exercise.muscleGroup}
                            {exercise.equipment ? ` • ${exercise.equipment}` : ""}
                          </p>
                        </div>
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Dumbbell className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          My library
                        </span>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          {exercise.usageCount} usage{exercise.usageCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => startEditing(exercise)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-destructive/25 bg-transparent text-destructive hover:bg-destructive/5 hover:text-destructive"
                          onClick={() => void handleDeleteExercise(exercise.id)}
                          disabled={deletingExerciseId === exercise.id}
                        >
                          {deletingExerciseId === exercise.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Shared Library</h2>
                  <p className="text-sm text-muted-foreground">System exercises available to every coach.</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {sharedExercises.length} items
                </span>
              </div>

              {sharedExercises.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Khong co bai tap nao khop voi bo loc hien tai.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {sharedExercises.map((exercise) => (
                    <div key={exercise.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{exercise.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {exercise.muscleGroup}
                            {exercise.equipment ? ` • ${exercise.equipment}` : ""}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                          <Dumbbell className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          Shared
                        </span>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          {exercise.variationName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
