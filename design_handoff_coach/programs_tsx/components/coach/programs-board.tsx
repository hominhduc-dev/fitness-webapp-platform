"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { AssignClientsDialog } from "@/components/coach/assign-clients-dialog"
import { ProgramCard } from "@/components/coach/program-card"
import {
  createCoachProgram,
  deleteCoachProgram,
  fetchCoachProgram,
} from "@/lib/fitness/api"
import type { AssignedTrainee, CoachProgram, CoachTrainee, CreateCoachProgramInput } from "@/lib/fitness/types"

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
  initialPrograms: CoachProgram[]
  trainees: CoachTrainee[]
}

export function ProgramsBoard({ initialPrograms, trainees }: ProgramsBoardProps) {
  const router = useRouter()
  const { session } = useAuth()
  const [programs, setPrograms] = useState(initialPrograms)
  const [assignTarget, setAssignTarget] = useState<CoachProgram | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const token = session?.access_token

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

  if (programs.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-border py-12 text-center">
        <h3 className="mb-2 text-lg font-semibold">No programs yet</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Create your first program to start assigning workouts to trainees.
        </p>
        <button
          type="button"
          onClick={() => router.push("/coach/programs/new")}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create program
        </button>
      </div>
    )
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            busy={busyId === program.id}
            onEdit={() => router.push(`/coach/programs/${program.id}`)}
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
    </>
  )
}
