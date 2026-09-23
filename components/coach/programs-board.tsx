"use client"

import { useMemo, useState } from "react"

import { ProgramEditorLazy } from "@/components/coach/program-editor-lazy"
import { COACH_DATA_STALE_TIME_MS, useCoachData, useCoachMutation } from "@/lib/queries/coach-data"
import { useExercises, useExerciseLibrary } from "@/lib/queries/exercises"
import { queryKeys } from "@/lib/queries/keys"
import { useQueryClient } from "@tanstack/react-query"
import { userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import { useAuth } from "@/components/providers/auth-provider"
import { AssignClientsDialog } from "@/components/coach/assign-clients-dialog"
import { ExportProgramLogsDialog } from "@/components/coach/export-program-logs-dialog"
import { ImportProgramDialog } from "@/components/coach/import-program-dialog"
import { ProgramCard } from "@/components/coach/program-card"
import { ProgramViewerDialog } from "@/components/coach/program-viewer-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { ChevronDown, ChevronRight, Loader2, Plus, Upload } from "lucide-react"

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
  const [viewTarget, setViewTarget] = useState<CoachProgram | null>(null)
  const [exportTarget, setExportTarget] = useState<CoachProgram | null>(null)
  const [editorTarget, setEditorTarget] = useState<"new" | string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [viewMode, setViewMode] = useState<"library" | "clients">("library")
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(() => new Set())
  const includePersonalized = viewMode === "clients"

  const programsQuery = useCoachData(
    queryKeys.coach.programs({ includeArchived: showArchived, includePersonalized }),
    (token) => fetchCoachPrograms(token, { includeArchived: showArchived, includePersonalized }),
    showArchived || includePersonalized ? undefined : initialPrograms,
  )
  const programs = programsQuery.data ?? []
  const setPrograms = programsQuery.setData
  const traineesQuery = useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees, initialTrainees)
  const trainees = traineesQuery.data ?? []
  // The 4k+ exercise catalogue is only needed by the import dialog. Program
  // cards and assignment actions should not pay that cost during initial load.
  const importExercisesQuery = useExercises(undefined, undefined, importOpen)
  const importLibraryQuery = useExerciseLibrary(undefined, undefined, importOpen)
  const exerciseOptions = useMemo(() => {
    if (initialExerciseOptions?.length) return initialExerciseOptions
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
  const clientProgramGroups = trainees
    .map((trainee) => ({
      trainee,
      programs: visiblePrograms.filter((program) =>
        program.assignedTrainees.some((assigned) => assigned.id === trainee.id) ||
        trainee.assignedProgramIds?.includes(program.id),
      ),
    }))
    .filter((group) => group.programs.length > 0)

  // The editor's own query, so a detail fetched ahead of time is the one it reads.
  const programDetailQuery = (programId: string) => ({
    queryKey: userQueryKey(queryKeys.coach.program(programId), profile?.id),
    queryFn: async () => fetchCoachProgram(await requireAccessToken(), programId),
    staleTime: COACH_DATA_STALE_TIME_MS,
  })

  // Opening the editor waits on its code and on the program's full detail, one
  // after the other. Starting both when the pointer reaches the card moves that
  // wait into the time it takes to reach the menu. The query is a no-op while
  // cached, and the import resolves once.
  const prefetchEditor = (programId: string) => {
    void import("@/components/coach/program-editor")
    void client.prefetchQuery(programDetailQuery(programId))
  }

  const handleDuplicate = async (program: CoachProgram) => {
    setBusyId(program.id)
    setError(null)
    try {
      // Re-fetch to make sure the full workout/exercise tree is loaded.
      const full = await client.fetchQuery(programDetailQuery(program.id))
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

  const toggleClientPrograms = (traineeId: string) => {
    setExpandedClientIds((current) => {
      const next = new Set(current)
      if (next.has(traineeId)) {
        next.delete(traineeId)
      } else {
        next.add(traineeId)
      }
      return next
    })
  }

  // One card for both views, so a client's program offers exactly the actions
  // the library does.
  const renderProgramCard = (program: CoachProgram) => (
    <ProgramCard
      key={program.id}
      program={program}
      busy={busyId === program.id}
      onEdit={() => setEditorTarget(program.id)}
      onView={() => setViewTarget(program)}
      onAssign={() => setAssignTarget(program)}
      onDuplicate={() => void handleDuplicate(program)}
      onArchive={() => void handleArchive(program)}
      onRestore={() => void handleRestore(program)}
      onDelete={() => void handleDelete(program)}
      onExportLogs={() => setExportTarget(program)}
      onIntent={() => prefetchEditor(program.id)}
    />
  )

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
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-end">
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" data-tour="coach-program-actions">
        <div className="grid grid-cols-2 rounded-xl border-2 border-primary/40 bg-muted/40 p-1 shadow-sm" data-tour="coach-program-tabs">
          <Button
            type="button"
            variant={viewMode === "library" ? "secondary" : "ghost"}
            size="sm"
            className={viewMode === "library" ? "h-9 bg-primary font-semibold text-primary-foreground hover:bg-primary/90" : "h-9 font-medium"}
            onClick={() => setViewMode("library")}
          >
            Library
          </Button>
          <Button
            type="button"
            variant={viewMode === "clients" ? "secondary" : "ghost"}
            size="sm"
            className={viewMode === "clients" ? "h-9 bg-primary font-semibold text-primary-foreground hover:bg-primary/90" : "h-9 font-medium"}
            onClick={() => setViewMode("clients")}
          >
            By client
          </Button>
        </div>
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

      {viewMode === "library" ? (
        <div
          className="grid gap-3.5"
          data-tour="coach-program-library"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
        >
          {visiblePrograms.map(renderProgramCard)}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {clientProgramGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground xl:col-span-2">
              No clients have assigned programs yet.
            </div>
          ) : (
            clientProgramGroups.map(({ trainee, programs: traineePrograms }) => {
              const isExpanded = expandedClientIds.has(trainee.id)

              return (
                <section key={trainee.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-expanded={isExpanded}
                    onClick={() => toggleClientPrograms(trainee.id)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {trainee.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold">{trainee.name}</span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{trainee.email}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="micro" className="bg-muted text-muted-foreground">
                        {traineePrograms.length} programs
                      </Badge>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  <div
                    className={isExpanded ? "border-t border-border px-4 py-3" : "hidden"}
                    aria-hidden={!isExpanded}
                  >
                    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                      {traineePrograms.map(renderProgramCard)}
                    </div>
                  </div>
                </section>
              )
            })
          )}

        </div>
      )}

      <ProgramViewerDialog program={viewTarget} onClose={() => setViewTarget(null)} />

      {exportTarget ? (
        <ExportProgramLogsDialog
          key={exportTarget.id}
          assignedTrainees={exportTarget.assignedTrainees}
          programDuration={exportTarget.duration}
          programId={exportTarget.id}
          programName={exportTarget.name}
          programStartDate={exportTarget.startDate}
          open
          onOpenChange={(next) => {
            if (!next) setExportTarget(null)
          }}
        />
      ) : null}

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
