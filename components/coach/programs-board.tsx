"use client"

import { useState } from "react"

import { ProgramEditorLazy } from "@/components/coach/program-editor-lazy"
import { useAuth } from "@/components/providers/auth-provider"
import { AssignClientsDialog } from "@/components/coach/assign-clients-dialog"
import { ProgramCard } from "@/components/coach/program-card"
import { Button } from "@/components/ui/button"
import {
  createCoachProgram,
  deleteCoachProgram,
  fetchCoachProgram,
} from "@/lib/fitness/api"
import type {
  AssignedTrainee,
  CoachProgram,
  CoachTrainee,
  CreateCoachProgramInput,
  ExerciseVariationOption,
} from "@/lib/fitness/types"
import { Plus } from "lucide-react"

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
  initialPrograms: CoachProgram[]
  trainees: CoachTrainee[]
}

export function ProgramsBoard({ exerciseOptions = [], initialPrograms, trainees }: ProgramsBoardProps) {
  const { session } = useAuth()
  const [programs, setPrograms] = useState(initialPrograms)
  const [assignTarget, setAssignTarget] = useState<CoachProgram | null>(null)
  const [editorTarget, setEditorTarget] = useState<"new" | string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const token = session?.access_token
  const totalAssignments = programs.reduce((sum, program) => sum + program.assignedTrainees.length, 0)
  const unassigned = programs.filter((program) => program.assignedTrainees.length === 0).length

  const handleDuplicate = async (program: CoachProgram) => {
    if (!token) return
    setBusyId(program.id)
    setError(null)
    try {
      // Re-fetch to make sure the full workout/exercise tree is loaded.
      const full = await fetchCoachProgram(token, program.id)
      const created = await createCoachProgram(token, toCreateInput(full, `${program.name} (copy)`))
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

  const handleDelete = async (program: CoachProgram) => {
    if (!token) return
    if (!window.confirm(`Delete "${program.name}"? This can't be undone.`)) return
    setBusyId(program.id)
    setError(null)
    try {
      await deleteCoachProgram(token, program.id)
      setPrograms((prev) => prev.filter((item) => item.id !== program.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete program.")
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
        <h1 className="mt-2 text-[36px] font-semibold leading-none tracking-[-0.02em]">{programs.length} authored.</h1>
        <p className="mt-1.5 font-mono text-[13px] tnum text-muted-foreground">
          {totalAssignments} clients training on a program · {unassigned} unassigned
        </p>
      </div>
      <Button
        type="button"
        className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90 sm:w-auto"
        onClick={() => setEditorTarget("new")}
      >
        <Plus className="h-4 w-4" />
        New program
      </Button>
    </div>
  )

  if (programs.length === 0) {
    return (
      <>
        {header}
        <div className="rounded-[10px] border border-dashed border-border py-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">No programs yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first program to start assigning workouts to trainees.
          </p>
          <Button type="button" onClick={() => setEditorTarget("new")}>
            Create program
          </Button>
        </div>
        {editor}
      </>
    )
  }

  return (
    <>
      {header}

      {error ? (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
      >
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            busy={busyId === program.id}
            onEdit={() => setEditorTarget(program.id)}
            onAssign={() => setAssignTarget(program)}
            onDuplicate={() => void handleDuplicate(program)}
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
    </>
  )
}
