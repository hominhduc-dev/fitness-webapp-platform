"use client"

import { useMemo, useState } from "react"

import { ProgramEditorLazy } from "@/components/coach/program-editor-lazy"
import { useCoachData, useCoachMutation } from "@/lib/queries/coach-data"
import { useExercises, useExerciseLibrary } from "@/lib/queries/exercises"
import { queryKeys } from "@/lib/queries/keys"
import { useQueryClient } from "@tanstack/react-query"
import { userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import { useAuth } from "@/components/providers/auth-provider"
import { AssignClientsDialog } from "@/components/coach/assign-clients-dialog"
import { ImportProgramDialog } from "@/components/coach/import-program-dialog"
import { ProgramCard } from "@/components/coach/program-card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  archiveCoachProgram,
  createCoachProgram,
  deleteCoachProgram,
  fetchCoachProgram,
  fetchCoachPrograms,
  fetchCoachTrainees,
  restoreCoachProgram,
} from "@/lib/fitness/api"
import { flattenExerciseLibraryToVariationOptions, mergeExerciseOptions } from "@/lib/fitness/exercise-options"
import type {
  AssignedTrainee,
  CoachProgram,
  CoachTrainee,
  CreateCoachProgramInput,
  ExerciseVariationOption,
} from "@/lib/fitness/types"
import { Loader2, Plus, Upload } from "lucide-react"

function isoDate(value?: Date) {
  if (!value) return undefined
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Build a CreateCoachProgramInput from an existing (fully-loaded) program. */
function toCreateInput(program: CoachProgram, name: string): CreateCoachProgramInput {
  return {
    name,
    description: program.description,
    difficulty: program.difficulty,
    duration: program.duration,
    assignToUserIds: [],
    workouts: program.workouts.map((workout) => ({
      name: workout.name,
      duration: workout.duration,
      scheduledDay: workout.scheduledDay,
      scheduledDate: isoDate(workout.scheduledDate),
      exercises: workout.exercises.map((exercise) => ({
        variationId: exercise.variation.id,
        sets: exercise.sets.length || 3,
        reps: exercise.sets[0]?.targetReps ?? 8,
        repsMin: exercise.sets[0]?.targetRepsMin,
        weight: exercise.sets[0]?.weight,
      })),
    })),
  }
}

interface ProgramsBoardProps {
  exerciseOptions?: ExerciseVariationOption[]
  initialPrograms?: CoachProgram[]
  trainees?: CoachTrainee[]
}

export function ProgramsBoard({ exerciseOptions: initialExerciseOptions, initialPrograms, trainees: initialTrainees }: ProgramsBoardProps) {
  const { profile, session } = useAuth()
  const client = useQueryClient()
  const [assignTarget, setAssignTarget] = useState<CoachProgram | null>(null)
  const [editorTarget, setEditorTarget] = useState<"new" | string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const programsQuery = useCoachData(queryKeys.coach.programs({ includeArchived: showArchived }), (token) => fetchCoachPrograms(token, { includeArchived: showArchived }), showArchived ? undefined : initialPrograms)
  const programs = programsQuery.data ?? []
  const setPrograms = programsQuery.setData
  const traineesQuery = useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees, initialTrainees)
  const trainees = traineesQuery.data ?? []
  // The 4k+ exercise catalogue is only needed by the import dialog. Program
  // cards and assignment actions should not pay that cost during initial load.
  const importExercisesQuery = useExercises(undefined, undefined, importOpen)
  const importLibraryQuery = useExerciseLibrary(undefined, undefined, importOpen)
  const exerciseOptions = useMemo(() => {
    if (initialExerciseOptions) return initialExerciseOptions
    if (!importExercisesQuery.data || !importLibraryQuery.data) return []
    return mergeExerciseOptions(
      importExercisesQuery.data,
      flattenExerciseLibraryToVariationOptions(importLibraryQuery.data),
    )
  }, [initialExerciseOptions, importExercisesQuery.data, importLibraryQuery.data])
  const createProgram = useCoachMutation(createCoachProgram)
  const archiveProgram = useCoachMutation(archiveCoachProgram)
  const restoreProgram = useCoachMutation(restoreCoachProgram)
  const deleteProgram = useCoachMutation(deleteCoachProgram)

  const visiblePrograms = showArchived ? programs : programs.filter((p) => !p.archivedAt)
  const totalAssignments = visiblePrograms.reduce((sum, program) => sum + program.assignedTrainees.length, 0)
  const unassigned = visiblePrograms.filter((program) => program.assignedTrainees.length === 0).length

  const handleDuplicate = async (program: CoachProgram) => {
    setBusyId(program.id)
    setError(null)
    try {
      // Re-fetch to make sure the full workout/exercise tree is loaded.
      const full = await client.fetchQuery({ queryKey: userQueryKey(queryKeys.coach.program(program.id), profile?.id), queryFn: async () => fetchCoachProgram(await requireAccessToken(), program.id), staleTime: 300_000 })
      const created = await createProgram.mutateAsync([toCreateInput(full, `${program.name} (copy)`)])
      setPrograms((prev) => {
        const index = prev.findIndex((item) => item.id === program.id)
        const next = prev.slice()
        next.splice(index + 1, 0, created)
        return next
      })
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate program.")
    } finally {
      setBusyId(null)
    }
  }

  const handleArchive = async (program: CoachProgram) => {
    if (
      !window.confirm(
        `Archive "${program.name}"? Lịch tập sống của trainee sẽ bị gỡ. Log lịch sử + export vẫn truy được.`,
      )
    ) {
      return
    }
    setBusyId(program.id)
    setError(null)
    try {
      const updated = await archiveProgram.mutateAsync([program.id])
      setPrograms((prev) => {
        // If we're hiding archived, remove it from view; otherwise flip its state in place.
        if (!showArchived) return prev.filter((item) => item.id !== program.id)
        return prev.map((item) => (item.id === program.id ? updated : item))
      })
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive program.")
    } finally {
      setBusyId(null)
    }
  }

  const handleRestore = async (program: CoachProgram) => {
    setBusyId(program.id)
    setError(null)
    try {
      const updated = await restoreProgram.mutateAsync([program.id])
      setPrograms((prev) => prev.map((item) => (item.id === program.id ? updated : item)))
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Unable to restore program.")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (program: CoachProgram) => {
    if (!window.confirm(`Permanently delete "${program.name}"? Không thể hoàn tác.`)) return
    setBusyId(program.id)
    setError(null)
    try {
      await deleteProgram.mutateAsync([program.id])
      setPrograms((prev) => prev.filter((item) => item.id !== program.id))
    } catch (deleteError) {
      // 409 → backend refuses because program has assignments or logs.
      const fallback = "Unable to delete program."
      const message = deleteError instanceof Error ? deleteError.message : fallback
      setError(
        /assignment|log|archive/i.test(message)
          ? "Program đã có log lịch sử — hãy dùng Archive."
          : message,
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleAssigned = (programId: string, assignedTrainees: AssignedTrainee[]) => {
    setPrograms((prev) =>
      prev.map((item) => (item.id === programId ? { ...item, assignedTrainees } : item)),
    )
  }

  const handleEditorSaved = (program: CoachProgram) => {
    setPrograms((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === program.id)

      if (existingIndex < 0) {
        return [program, ...prev]
      }

      return prev.map((item) => (item.id === program.id ? program : item))
    })
  }

  const handleImported = (program: CoachProgram) => {
    setPrograms((prev) => [program, ...prev.filter((item) => item.id !== program.id)])
  }

  const editor =
    editorTarget === null ? null : (
      <ProgramEditorLazy
        initialExerciseOptions={exerciseOptions}
        initialTraineeOptions={trainees}
        programId={editorTarget === "new" ? undefined : editorTarget}
        onClose={() => setEditorTarget(null)}
        onSaved={handleEditorSaved}
      />
    )

  const header = (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="label-micro">Programs</p>
        <h1 className="mt-2 text-3xl font-semibold leading-none tracking-[-0.02em] sm:text-4xl">{visiblePrograms.length} authored.</h1>
        <p className="mt-1.5 font-mono text-sm tnum text-muted-foreground">
          {totalAssignments} clients training on a program · {unassigned} unassigned
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <label className="flex select-none items-center gap-2 text-sm text-muted-foreground sm:mr-2">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          Show archived
        </label>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 bg-transparent sm:w-auto"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Import program
        </Button>
        <Button
          type="button"
          className="w-full gap-2 sm:w-auto"
          onClick={() => setEditorTarget("new")}
        >
          <Plus className="h-4 w-4" />
          New program
        </Button>
      </div>
    </div>
  )

  if (programsQuery.isPending) {
    return (
      <>
        {header}
        <div className="flex min-h-72 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading programs...
        </div>
      </>
    )
  }

  if (programsQuery.isError) {
    return (
      <>
        {header}
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive-soft px-4 text-center">
          <p className="text-sm text-destructive-text">Unable to load programs.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void programsQuery.refetch()}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  if (visiblePrograms.length === 0) {
    return (
      <>
        {header}
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">No programs yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first program to start assigning workouts to trainees.
          </p>
          <Button type="button" onClick={() => setEditorTarget("new")}>
            Create program
          </Button>
        </div>
        {editor}
        <ImportProgramDialog
          exerciseOptions={exerciseOptions}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
          open={importOpen}
          trainees={trainees}
        />
      </>
    )
  }

  return (
    <>
      {header}

      {error ? (
        <div className="mb-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{error}</div>
      ) : null}

      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
      >
        {visiblePrograms.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            busy={busyId === program.id}
            onEdit={() => setEditorTarget(program.id)}
            onAssign={() => setAssignTarget(program)}
            onDuplicate={() => void handleDuplicate(program)}
            onArchive={() => void handleArchive(program)}
            onRestore={() => void handleRestore(program)}
            onDelete={() => void handleDelete(program)}
          />
        ))}
      </div>

      <AssignClientsDialog
        program={assignTarget}
        trainees={trainees}
        onClose={() => setAssignTarget(null)}
        onAssigned={handleAssigned}
      />

      {editor}

      <ImportProgramDialog
        exerciseOptions={exerciseOptions}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
        open={importOpen}
        token={session?.access_token ?? ""}
        trainees={trainees}
      />
    </>
  )
}
